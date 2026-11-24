create or replace function public.book_mentor_slot(
  p_mentor_id uuid,
  p_date_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_id uuid;
begin
  if not public.is_active_incube() then
    raise exception 'Incubé actif requis.' using errcode = '42501';
  end if;
  if p_date_time is null or p_date_time <= now() then
    raise exception 'Ce créneau est déjà passé.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.projects p
    join public.profiles mentor
      on mentor.id = p.mentor_id and mentor.role = 'mentor' and mentor.status = 'active'
    where p.incube_id = auth.uid()
      and p.mentor_id = p_mentor_id
  ) then
    raise exception 'Mentor non assigné à cet incubé.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_mentor_id::text || p_date_time::text, 0));

  if not exists (
    select 1
    from public.mentor_availability a
    where a.mentor_id = p_mentor_id
      and a.is_active
      and extract(dow from p_date_time at time zone a.time_zone)::integer = a.day_of_week
      and (p_date_time at time zone a.time_zone)::date
        <= (now() at time zone a.time_zone)::date + 30
      and (p_date_time at time zone a.time_zone)::time = a.start_time
  ) then
    raise exception 'Ce créneau ne fait plus partie des disponibilités du mentor.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.mentor_id = p_mentor_id
      and a.date_time = p_date_time
      and a.status in ('pending', 'accepted')
  ) then
    raise exception 'Ce créneau vient d’être réservé. Choisis-en un autre.' using errcode = '23505';
  end if;

  insert into public.appointments (incube_id, mentor_id, date_time, status)
  values (auth.uid(), p_mentor_id, p_date_time, 'pending')
  returning id into appointment_id;

  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (
    p_mentor_id,
    'appointment_proposed',
    'Nouvelle demande de rendez-vous',
    'Un incubé a demandé ce créneau. Confirme ou refuse sa demande dans ton agenda.',
    appointment_id
  );

  return appointment_id;
end;
$$;
