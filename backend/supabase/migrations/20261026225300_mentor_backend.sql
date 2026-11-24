alter table public.deliverables
  add column if not exists created_at timestamptz not null default now();

alter table public.appointments
  add column if not exists meeting_url text;

alter table public.messages
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists read_at timestamptz;

create table if not exists public.mentor_availability (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  time_zone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint mentor_availability_valid_range check (start_time < end_time),
  constraint mentor_availability_unique_slot unique (mentor_id, day_of_week, start_time, end_time)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

grant select, insert, delete on public.mentor_availability to authenticated;
grant select on public.notifications to authenticated;
grant select on public.profiles, public.projects, public.progressions,
  public.formations, public.deliverables, public.appointments, public.messages
  to authenticated;
grant insert on public.deliverables, public.appointments, public.messages to authenticated;
grant insert, update, delete on public.progressions to authenticated;

create index if not exists projects_mentor_incube_idx
  on public.projects (mentor_id, incube_id);
create index if not exists progressions_user_idx
  on public.progressions (user_id);
create index if not exists deliverables_project_created_idx
  on public.deliverables (project_id, created_at desc);
create index if not exists appointments_mentor_date_idx
  on public.appointments (mentor_id, date_time);
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, read_at);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

create or replace function public.is_active_mentor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mentor' and status = 'active'
  );
$$;

revoke all on function public.is_active_mentor() from public, anon;
grant execute on function public.is_active_mentor() to authenticated;

create or replace function public.is_active_incube()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'incube' and status = 'active'
  );
$$;

revoke all on function public.is_active_incube() from public, anon;
grant execute on function public.is_active_incube() to authenticated;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

alter table public.mentor_availability enable row level security;
alter table public.notifications enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.progressions enable row level security;
alter table public.deliverables enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;

drop policy if exists mentor_read_self_and_assigned_profiles on public.profiles;
create policy mentor_read_self_and_assigned_profiles
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      exists (
        select 1 from public.projects p
        where p.incube_id = profiles.id and p.mentor_id = auth.uid()
      )
      and public.is_active_mentor()
    )
  );

drop policy if exists admin_read_all_profiles on public.profiles;
create policy admin_read_all_profiles
  on public.profiles for select to authenticated
  using (public.is_active_admin());

drop policy if exists mentor_read_assigned_projects on public.projects;
create policy mentor_read_assigned_projects
  on public.projects for select to authenticated
  using (mentor_id = auth.uid() and public.is_active_mentor());

drop policy if exists incube_read_own_projects on public.projects;
create policy incube_read_own_projects
  on public.projects for select to authenticated
  using (incube_id = auth.uid() and public.is_active_incube());

drop policy if exists admin_read_all_projects on public.projects;
create policy admin_read_all_projects
  on public.projects for select to authenticated
  using (public.is_active_admin());

drop policy if exists mentor_read_assigned_progressions on public.progressions;
create policy mentor_read_assigned_progressions
  on public.progressions for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.incube_id = progressions.user_id and p.mentor_id = auth.uid()
    )
    and public.is_active_mentor()
  );

drop policy if exists incube_read_own_progressions on public.progressions;
create policy incube_read_own_progressions
  on public.progressions for select to authenticated
  using (user_id = auth.uid() and public.is_active_incube());

drop policy if exists incube_update_own_progressions on public.progressions;
create policy incube_update_own_progressions
  on public.progressions for all to authenticated
  using (user_id = auth.uid() and public.is_active_incube())
  with check (user_id = auth.uid() and public.is_active_incube());

drop policy if exists admin_read_all_progressions on public.progressions;
create policy admin_read_all_progressions
  on public.progressions for select to authenticated
  using (public.is_active_admin());

drop policy if exists mentor_read_assigned_deliverables on public.deliverables;
create policy mentor_read_assigned_deliverables
  on public.deliverables for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = deliverables.project_id and p.mentor_id = auth.uid()
    )
    and public.is_active_mentor()
  );

drop policy if exists incube_read_own_deliverables on public.deliverables;
create policy incube_read_own_deliverables
  on public.deliverables for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = deliverables.project_id and p.incube_id = auth.uid()
    )
    and public.is_active_incube()
  );

drop policy if exists incube_add_own_deliverables on public.deliverables;
create policy incube_add_own_deliverables
  on public.deliverables for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = deliverables.project_id and p.incube_id = auth.uid()
    )
    and public.is_active_incube()
  );

drop policy if exists admin_read_all_deliverables on public.deliverables;
create policy admin_read_all_deliverables
  on public.deliverables for select to authenticated
  using (public.is_active_admin());

drop policy if exists mentor_read_own_appointments on public.appointments;
create policy mentor_read_own_appointments
  on public.appointments for select to authenticated
  using (mentor_id = auth.uid() and public.is_active_mentor());

drop policy if exists incube_read_own_appointments on public.appointments;
create policy incube_read_own_appointments
  on public.appointments for select to authenticated
  using (incube_id = auth.uid() and public.is_active_incube());

drop policy if exists admin_read_all_appointments on public.appointments;
create policy admin_read_all_appointments
  on public.appointments for select to authenticated
  using (public.is_active_admin());

drop policy if exists incube_request_mentor_appointment on public.appointments;
create policy incube_request_mentor_appointment
  on public.appointments for insert to authenticated
  with check (
    incube_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles incube
      where incube.id = auth.uid() and incube.role = 'incube' and incube.status = 'active'
    )
    and exists (
      select 1 from public.projects p
      where p.incube_id = auth.uid() and p.mentor_id = appointments.mentor_id
    )
  );

drop policy if exists mentor_read_conversation_messages on public.messages;
create policy mentor_read_conversation_messages
  on public.messages for select to authenticated
  using (
    (sender_id = auth.uid() or receiver_id = auth.uid())
    and public.is_active_mentor()
  );

drop policy if exists message_participant_read_own on public.messages;
create policy message_participant_read_own
  on public.messages for select to authenticated
  using (
    (sender_id = auth.uid() or receiver_id = auth.uid())
    and (public.is_active_mentor() or public.is_active_incube())
  );

drop policy if exists mentor_send_to_assigned_incube on public.messages;
create policy mentor_send_to_assigned_incube
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_mentor()
    and exists (
      select 1 from public.projects p
      where p.mentor_id = auth.uid() and p.incube_id = messages.receiver_id
    )
  );

drop policy if exists message_participant_send_to_assigned_user on public.messages;
create policy message_participant_send_to_assigned_user
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (
        public.is_active_mentor()
        and exists (
          select 1 from public.projects p
          where p.mentor_id = auth.uid() and p.incube_id = messages.receiver_id
        )
      )
      or (
        exists (
          select 1 from public.profiles incube
          where incube.id = auth.uid() and incube.role = 'incube' and incube.status = 'active'
        )
        and exists (
          select 1 from public.projects p
          where p.incube_id = auth.uid() and p.mentor_id = messages.receiver_id
        )
      )
    )
  );

drop policy if exists mentor_read_own_notifications on public.notifications;
create policy mentor_read_own_notifications
  on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_active_mentor());

drop policy if exists user_read_own_notifications on public.notifications;
create policy user_read_own_notifications
  on public.notifications for select to authenticated
  using (
    user_id = auth.uid()
    and (public.is_active_mentor() or public.is_active_incube())
  );

drop policy if exists admin_read_all_notifications on public.notifications;
create policy admin_read_all_notifications
  on public.notifications for select to authenticated
  using (public.is_active_admin());

drop policy if exists mentor_read_own_availability on public.mentor_availability;
create policy mentor_read_own_availability
  on public.mentor_availability for select to authenticated
  using (mentor_id = auth.uid() and public.is_active_mentor());

drop policy if exists mentor_add_own_availability on public.mentor_availability;
create policy mentor_add_own_availability
  on public.mentor_availability for insert to authenticated
  with check (
    mentor_id = auth.uid()
    and public.is_active_mentor()
  );

drop policy if exists mentor_read_formations on public.formations;
drop policy if exists authenticated_read_formations on public.formations;
create policy authenticated_read_formations
  on public.formations for select to authenticated
  using (true);

drop policy if exists mentor_delete_own_availability on public.mentor_availability;
create policy mentor_delete_own_availability
  on public.mentor_availability for delete to authenticated
  using (
    mentor_id = auth.uid()
    and public.is_active_mentor()
  );

create or replace function public.notify_mentor_of_new_deliverable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body, entity_id)
  select p.mentor_id, 'new_deliverable', 'Nouveau livrable déposé',
         'Un incubé a déposé un nouveau livrable.', new.id
  from public.projects p
  where p.id = new.project_id and p.mentor_id is not null;
  return new;
end;
$$;

drop trigger if exists deliverable_mentor_notification on public.deliverables;
create trigger deliverable_mentor_notification
  after insert on public.deliverables
  for each row execute function public.notify_mentor_of_new_deliverable();

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (new.receiver_id, 'new_message', 'Nouveau message',
          'Vous avez reçu un nouveau message.', new.id);
  return new;
end;
$$;

drop trigger if exists message_recipient_notification on public.messages;
create trigger message_recipient_notification
  after insert on public.messages
  for each row execute function public.notify_message_recipient();

create or replace function public.submit_mentor_feedback(
  p_deliverable_id uuid,
  p_feedback text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_deliverable public.deliverables%rowtype;
  assigned_incube_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mentor' and status = 'active'
  ) then
    raise exception 'Mentor actif requis.' using errcode = '42501';
  end if;
  if p_feedback is null or char_length(btrim(p_feedback)) not between 1 and 3000 then
    raise exception 'Le feedback doit contenir entre 1 et 3000 caractères.'
      using errcode = '22023';
  end if;

  update public.deliverables d
  set feedback_mentor = p_feedback
  from public.projects p
  where d.id = p_deliverable_id
    and p.id = d.project_id
    and p.mentor_id = auth.uid()
  returning d.* into updated_deliverable;

  if not found then
    raise exception 'Livrable introuvable.' using errcode = 'P0002';
  end if;

  select p.incube_id into assigned_incube_id
  from public.projects p
  where p.id = updated_deliverable.project_id;

  insert into public.notifications (user_id, kind, title, body, entity_id)
  values (assigned_incube_id, 'mentor_feedback', 'Nouveau feedback du mentor',
          'Votre mentor a ajouté un feedback sur votre livrable.', updated_deliverable.id);

  return to_jsonb(updated_deliverable);
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
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Statut de rendez-vous invalide.' using errcode = '22023';
  end if;
  if p_meeting_url is not null and p_meeting_url not like 'https://meet.google.com/%' then
    raise exception 'Lien Google Meet invalide.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mentor' and status = 'active'
  ) then
    raise exception 'Mentor actif requis.' using errcode = '42501';
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

create or replace function public.mark_mentor_message_read(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_message public.messages%rowtype;
begin
  update public.messages m
  set read_at = coalesce(m.read_at, now())
  where m.id = p_message_id
    and m.receiver_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'mentor' and p.status = 'active'
    )
  returning m.* into updated_message;

  if not found then
    raise exception 'Message introuvable.' using errcode = 'P0002';
  end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where entity_id = updated_message.id
    and user_id = auth.uid()
    and kind = 'new_message';
  return to_jsonb(updated_message);
end;
$$;

create or replace function public.mark_mentor_notification_read(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_notification public.notifications%rowtype;
begin
  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'mentor' and p.status = 'active'
    )
  returning n.* into updated_notification;

  if not found then
    raise exception 'Notification introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(updated_notification);
end;
$$;

revoke all on function public.submit_mentor_feedback(uuid, text) from public, anon;
revoke all on function public.update_mentor_appointment(uuid, text, text) from public, anon;
revoke all on function public.mark_mentor_message_read(uuid) from public, anon;
revoke all on function public.mark_mentor_notification_read(uuid) from public, anon;
grant execute on function public.submit_mentor_feedback(uuid, text) to authenticated;
grant execute on function public.update_mentor_appointment(uuid, text, text) to authenticated;
grant execute on function public.mark_mentor_message_read(uuid) to authenticated;
grant execute on function public.mark_mentor_notification_read(uuid) to authenticated;
