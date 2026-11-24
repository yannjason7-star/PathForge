drop policy if exists incube_read_assigned_mentor_availability on public.mentor_availability;
create policy incube_read_assigned_mentor_availability
  on public.mentor_availability for select to authenticated
  using (
    public.is_active_incube()
    and exists (
      select 1
      from public.projects p
      where p.incube_id = auth.uid()
        and p.mentor_id = mentor_availability.mentor_id
    )
  );

create or replace function public.get_mentor_slots(p_mentor_id uuid)
returns table (date_time timestamptz, end_time timestamptz, time_zone text, is_booked boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_incube() or not exists (
    select 1
    from public.projects p
    join public.profiles mentor
      on mentor.id = p.mentor_id and mentor.role = 'mentor' and mentor.status = 'active'
    where p.incube_id = auth.uid()
      and p.mentor_id = p_mentor_id
  ) then
    raise exception 'Mentor non assigné à cet incubé.' using errcode = '42501';
  end if;

  return query
  with slot_instances as (
    select
      (days.slot_day::date + a.start_time) at time zone a.time_zone as slot_start,
      (days.slot_day::date + a.end_time) at time zone a.time_zone as slot_end,
      a.time_zone as slot_time_zone
    from public.mentor_availability a
    cross join lateral generate_series(
      ((now() at time zone a.time_zone)::date)::timestamp,
      (((now() at time zone a.time_zone)::date + 30))::timestamp,
      interval '1 day'
    ) as days(slot_day)
    where a.mentor_id = p_mentor_id
      and a.is_active
      and extract(dow from days.slot_day)::integer = a.day_of_week
  )
  select
    slots.slot_start,
    max(slots.slot_end),
    slots.slot_time_zone,
    bool_or(exists (
      select 1
      from public.appointments a
      where a.mentor_id = p_mentor_id
        and a.date_time = slots.slot_start
        and a.status in ('pending', 'accepted')
    ))
  from slot_instances slots
  where slots.slot_start > now()
  group by slots.slot_start, slots.slot_time_zone
  order by slots.slot_start;
end;
$$;

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
  booked_appointment_id uuid;
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
  values (auth.uid(), p_mentor_id, p_date_time, 'accepted')
  returning id into booked_appointment_id;

  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (
    p_mentor_id,
    'appointment_booked',
    'Nouveau rendez-vous réservé',
    'Un incubé a réservé un créneau dans tes disponibilités.',
    booked_appointment_id
  );

  return booked_appointment_id;
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_appointment public.appointments%rowtype;
  notification_user_id uuid;
begin
  if not public.is_active_incube() and not public.is_active_mentor() then
    raise exception 'Un compte actif est requis.' using errcode = '42501';
  end if;

  update public.appointments a
  set status = 'cancelled'
  where a.id = p_appointment_id
    and a.date_time > now()
    and a.status in ('pending', 'accepted')
    and (
      (public.is_active_mentor() and a.mentor_id = auth.uid())
      or (public.is_active_incube() and a.incube_id = auth.uid())
    )
  returning a.* into updated_appointment;

  if not found then
    raise exception 'Rendez-vous à venir introuvable ou déjà annulé.' using errcode = 'P0002';
  end if;

  notification_user_id := case
    when updated_appointment.mentor_id = auth.uid() then updated_appointment.incube_id
    else updated_appointment.mentor_id
  end;
  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (
    notification_user_id,
    'appointment_cancelled',
    'Rendez-vous annulé',
    'Ton mentor ou ton incubé a annulé un rendez-vous.',
    updated_appointment.id
  );

  return to_jsonb(updated_appointment);
end;
$$;

revoke all on function public.get_mentor_slots(uuid) from public, anon;
revoke all on function public.book_mentor_slot(uuid, timestamptz) from public, anon;
revoke all on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.get_mentor_slots(uuid) to authenticated;
grant execute on function public.book_mentor_slot(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;
