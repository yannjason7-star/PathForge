create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_logs_occurred_at_idx
  on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, occurred_at desc);
create index if not exists audit_logs_table_record_idx
  on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

drop policy if exists admin_read_audit_logs on public.audit_logs;
create policy admin_read_audit_logs
  on public.audit_logs for select to authenticated
  using (public.is_active_admin());

revoke insert, update, delete on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  record_id text;
  old_json jsonb;
  new_json jsonb;
begin
  old_json := case when tg_op = 'DELETE' or tg_op = 'UPDATE' then to_jsonb(old) else null end;
  new_json := case when tg_op = 'INSERT' or tg_op = 'UPDATE' then to_jsonb(new) else null end;
  record_id := coalesce(
    new_json ->> 'id',
    old_json ->> 'id',
    new_json ->> 'p_profile_id',
    old_json ->> 'p_profile_id'
  );

  insert into public.audit_logs (
    actor_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    tg_table_name,
    record_id,
    tg_op,
    old_json,
    new_json
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.record_audit_log() from public, anon, authenticated;

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.record_audit_log();

drop trigger if exists audit_projects on public.projects;
create trigger audit_projects
  after insert or update or delete on public.projects
  for each row execute function public.record_audit_log();

drop trigger if exists audit_progressions on public.progressions;
create trigger audit_progressions
  after insert or update or delete on public.progressions
  for each row execute function public.record_audit_log();

drop trigger if exists audit_deliverables on public.deliverables;
create trigger audit_deliverables
  after insert or update or delete on public.deliverables
  for each row execute function public.record_audit_log();

drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.record_audit_log();

drop trigger if exists audit_messages on public.messages;
create trigger audit_messages
  after insert or update or delete on public.messages
  for each row execute function public.record_audit_log();

drop trigger if exists audit_formations on public.formations;
create trigger audit_formations
  after insert or update or delete on public.formations
  for each row execute function public.record_audit_log();

drop view if exists public.audit_recent_activity;
create view public.audit_recent_activity
with (security_invoker = true) as
select
  id,
  occurred_at,
  actor_id,
  table_name,
  record_id,
  action,
  old_data,
  new_data
from public.audit_logs
where public.is_active_admin();

grant select on public.audit_recent_activity to authenticated;
