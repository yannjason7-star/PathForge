alter table public.formations
  add column if not exists description text,
  add column if not exists resource_type text,
  add column if not exists resource_url text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

update public.formations
set resource_type = 'document'
where resource_type is null;

alter table public.formations
  alter column resource_type set default 'document';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'formations_resource_type_check'
      and conrelid = 'public.formations'::regclass
  ) then
    alter table public.formations
      add constraint formations_resource_type_check
      check (resource_type in ('book', 'video', 'document'));
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'formations',
  'formations',
  false,
  104857600,
  array[
    'application/pdf',
    'application/epub+zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant insert, update, delete on public.formations to authenticated;

drop policy if exists mentor_manage_formations on public.formations;
create policy mentor_manage_formations
  on public.formations for all to authenticated
  using (
    public.is_active_mentor()
    and (created_by = auth.uid() or created_by is null)
  )
  with check (
    public.is_active_mentor()
    and created_by = auth.uid()
  );

drop policy if exists storage_mentor_upload_formation on storage.objects;
create policy storage_mentor_upload_formation
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'formations'
    and public.is_active_mentor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_mentor_read_formation on storage.objects;
create policy storage_mentor_read_formation
  on storage.objects for select to authenticated
  using (
    bucket_id = 'formations'
    and (
      (public.is_active_mentor() and (storage.foldername(name))[1] = auth.uid()::text)
      or public.is_active_incube()
      or public.is_active_admin()
    )
  );

drop policy if exists storage_mentor_delete_formation on storage.objects;
create policy storage_mentor_delete_formation
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'formations'
    and public.is_active_mentor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
