drop function if exists public.update_mentor_appointment(uuid, text, text);

create or replace function public.update_mentor_appointment(
  p_appointment_id uuid,
  p_status text
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
  if p_status is null or p_status not in ('accepted', 'rejected') then
    raise exception 'Statut de rendez-vous invalide.' using errcode = '22023';
  end if;
  if not public.is_active_mentor() then
    raise exception 'Mentor actif requis.' using errcode = '42501';
  end if;

  select a.date_time into requested_date_time
  from public.appointments a
  where a.id = p_appointment_id
    and a.mentor_id = auth.uid()
    and a.status = 'pending'
  for update;
  if not found then
    raise exception 'Demande de rendez-vous en attente introuvable.' using errcode = 'P0002';
  end if;
  if requested_date_time <= clock_timestamp() then
    raise exception 'La date proposée est déjà passée.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || requested_date_time::text, 0));

  if p_status = 'accepted' and exists (
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

  update public.appointments a
  set status = p_status
  where a.id = p_appointment_id
    and a.mentor_id = auth.uid()
    and a.status = 'pending'
    and a.date_time > clock_timestamp()
  returning a.* into updated_appointment;

  if not found then
    raise exception 'La demande est expirée ou a déjà été traitée.' using errcode = 'P0002';
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

  return to_jsonb(updated_appointment) - 'meeting_url';
end;
$$;

revoke all on function public.update_mentor_appointment(uuid, text) from public, anon;
grant execute on function public.update_mentor_appointment(uuid, text) to authenticated;
