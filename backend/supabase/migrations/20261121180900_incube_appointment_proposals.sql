alter table public.appointments
  add column if not exists incube_message text;

drop policy if exists incube_request_mentor_appointment on public.appointments;
revoke insert on public.appointments from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_incube_message_length'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_incube_message_length
      check (incube_message is null or char_length(incube_message) between 1 and 500);
  end if;
end;
$$;

create or replace function public.propose_mentor_appointment(
  p_mentor_id uuid,
  p_date_time timestamptz,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_id uuid;
  cleaned_message text := btrim(p_message);
begin
  if not public.is_active_incube() then
    raise exception 'Incubé actif requis.' using errcode = '42501';
  end if;
  if p_date_time is null or p_date_time <= now() then
    raise exception 'La date proposée doit être dans le futur.' using errcode = '22023';
  end if;
  if cleaned_message is null or char_length(cleaned_message) not between 1 and 500 then
    raise exception 'Le message doit contenir entre 1 et 500 caractères.' using errcode = '22023';
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

  if exists (
    select 1
    from public.appointments a
    where a.mentor_id = p_mentor_id
      and a.date_time = p_date_time
      and a.status in ('pending', 'accepted')
  ) then
    raise exception 'Ce créneau est déjà demandé ou réservé.' using errcode = '23505';
  end if;

  insert into public.appointments (incube_id, mentor_id, date_time, status, incube_message)
  values (auth.uid(), p_mentor_id, p_date_time, 'pending', cleaned_message)
  returning id into appointment_id;

  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (
    p_mentor_id,
    'appointment_proposed',
    'Nouvelle proposition de rendez-vous',
    'Un incubé propose un rendez-vous. Consulte son message dans ton agenda.',
    appointment_id
  );

  return appointment_id;
end;
$$;

create or replace function public.update_mentor_appointment(
  p_appointment_id uuid,
  p_status text,
  p_meeting_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_appointment public.appointments%rowtype;
  requested_date_time timestamptz;
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Statut de rendez-vous invalide.' using errcode = '22023';
  end if;
  if p_meeting_url is not null and p_meeting_url not like 'https://meet.google.com/%' then
    raise exception 'Lien Google Meet invalide.' using errcode = '22023';
  end if;
  if not public.is_active_mentor() then
    raise exception 'Mentor actif requis.' using errcode = '42501';
  end if;

  if p_status = 'accepted' then
    select a.date_time into requested_date_time
    from public.appointments a
    where a.id = p_appointment_id
      and a.mentor_id = auth.uid()
      and a.status = 'pending'
    for update;
    if not found then
      raise exception 'Demande de rendez-vous en attente introuvable.' using errcode = 'P0002';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || requested_date_time::text, 0));

    if exists (
      select 1
      from public.appointments requested
      join public.appointments reserved
        on reserved.mentor_id = requested.mentor_id
        and reserved.date_time = requested.date_time
        and reserved.status = 'accepted'
        and reserved.id <> requested.id
      where requested.id = p_appointment_id
        and requested.mentor_id = auth.uid()
        and requested.status = 'pending'
    ) then
      raise exception 'Ce créneau a déjà été réservé.' using errcode = '23505';
    end if;
  end if;

  update public.appointments a
  set status = p_status, meeting_url = p_meeting_url
  where a.id = p_appointment_id
    and a.mentor_id = auth.uid()
    and a.status = 'pending'
  returning a.* into updated_appointment;

  if not found then
    raise exception 'Demande de rendez-vous en attente introuvable.' using errcode = 'P0002';
  end if;

  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (
    updated_appointment.incube_id,
    case when p_status = 'accepted' then 'appointment_accepted' else 'appointment_rejected' end,
    case when p_status = 'accepted' then 'Rendez-vous accepté' else 'Rendez-vous refusé' end,
    case when p_status = 'accepted' then 'Votre mentor a accepté votre demande de rendez-vous.'
      else 'Votre mentor a refusé votre demande de rendez-vous.' end,
    updated_appointment.id
  );

  return to_jsonb(updated_appointment);
end;
$$;

revoke all on function public.propose_mentor_appointment(uuid, timestamptz, text) from public, anon;
grant execute on function public.propose_mentor_appointment(uuid, timestamptz, text) to authenticated;
