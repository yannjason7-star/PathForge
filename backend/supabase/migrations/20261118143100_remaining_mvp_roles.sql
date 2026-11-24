create or replace function public.is_active_enterprise()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'entreprise' and status = 'active'
  );
$$;

revoke all on function public.is_active_enterprise() from public, anon;
grant execute on function public.is_active_enterprise() to authenticated;

drop policy if exists enterprise_read_profiles on public.profiles;
create policy enterprise_read_profiles
  on public.profiles for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists enterprise_read_projects on public.projects;
create policy enterprise_read_projects
  on public.projects for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists enterprise_read_progressions on public.progressions;
create policy enterprise_read_progressions
  on public.progressions for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists enterprise_read_deliverables on public.deliverables;
create policy enterprise_read_deliverables
  on public.deliverables for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists enterprise_read_appointments on public.appointments;
create policy enterprise_read_appointments
  on public.appointments for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists enterprise_read_formations on public.formations;
create policy enterprise_read_formations
  on public.formations for select to authenticated
  using (public.is_active_enterprise());

drop policy if exists admin_update_profiles on public.profiles;
create policy admin_update_profiles
  on public.profiles for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

create or replace function public.admin_update_profile(
  p_profile_id uuid,
  p_role text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  if not public.is_active_admin() then
    raise exception 'Administrateur actif requis.' using errcode = '42501';
  end if;
  if p_role not in ('incube', 'mentor', 'entreprise', 'admin') then
    raise exception 'Rôle invalide.' using errcode = '22023';
  end if;
  if p_status not in ('active', 'pending', 'inactive') then
    raise exception 'Statut invalide.' using errcode = '22023';
  end if;

  update public.profiles
  set role = p_role, status = p_status
  where id = p_profile_id
  returning * into updated_profile;

  if not found then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(updated_profile);
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text) to authenticated;
