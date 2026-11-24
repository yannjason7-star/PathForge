with reopened_appointments as (
  update public.appointments
  set status = 'pending',
      meeting_url = null
  where status = 'rejected'
    and date_time > clock_timestamp()
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
