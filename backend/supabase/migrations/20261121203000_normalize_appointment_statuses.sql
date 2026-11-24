begin;

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  alter column status set default 'pending';

with reopened_appointments as (
  update public.appointments
  set status = 'pending',
      meeting_url = null
  where date_time > clock_timestamp()
    and lower(btrim(status::text)) in (
      'annule', 'annulé', 'annulee', 'annulée',
      'rejected', 'refuse', 'refusé', 'refusee', 'refusée'
    )
  returning id, mentor_id
)
insert into public.notifications (user_id, kind, title, body, entity_id)
select
  mentor_id,
  'appointment_proposed',
  'Demande de rendez-vous à traiter',
  'Une proposition future est de nouveau en attente de ta réponse.',
  id
from reopened_appointments;

with pending_appointments as (
  update public.appointments
  set status = 'pending'
  where lower(btrim(status::text)) = 'en_attente'
  returning id, mentor_id, date_time
)
insert into public.notifications (user_id, kind, title, body, entity_id)
select
  mentor_id,
  'appointment_proposed',
  'Demande de rendez-vous à traiter',
  'Une proposition est en attente de ta réponse.',
  id
from pending_appointments
where date_time > clock_timestamp();

update public.appointments
set status = case lower(btrim(status::text))
  when 'en_attente' then 'pending'
  when 'accepted' then 'accepted'
  when 'accepte' then 'accepted'
  when 'accepté' then 'accepted'
  when 'confirme' then 'accepted'
  when 'confirmé' then 'accepted'
  when 'cancelled' then 'cancelled'
  when 'canceled' then 'cancelled'
  when 'annule' then 'cancelled'
  when 'annulé' then 'cancelled'
  when 'annulee' then 'cancelled'
  when 'annulée' then 'cancelled'
  when 'rejected' then 'rejected'
  when 'refuse' then 'rejected'
  when 'refusé' then 'rejected'
  when 'refusee' then 'rejected'
  when 'refusée' then 'rejected'
  when 'completed' then 'completed'
  when 'termine' then 'completed'
  when 'terminé' then 'completed'
end
where lower(btrim(status::text)) in (
  'en_attente',
  'accepted', 'accepte', 'accepté', 'confirme', 'confirmé',
  'cancelled', 'canceled', 'annule', 'annulé', 'annulee', 'annulée',
  'rejected', 'refuse', 'refusé', 'refusee', 'refusée',
  'completed', 'termine', 'terminé'
);

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed'));

commit;
