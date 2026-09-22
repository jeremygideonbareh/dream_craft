-- =========================================================
-- Admin panel: staff accounts, editable content, publishing
--
-- Roles
--   admin  everything: all content, pricing, settings, team, delete
--   staff  enquiries + products + gallery only
--
-- Access is enforced here, in the database, not only in the admin screens.
-- =========================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------
-- Who may use the admin panel
-- ---------------------------------------------------------
create table if not exists public.staff_members (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;

-- An admin adds someone by email here. They get access when they sign up at
-- /admin with that email and confirm it, which proves they own the mailbox.
create table if not exists public.staff_invites (
  email      text primary key,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  name       text,
  invited_by uuid,
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid() and active and role = 'admin');
$$;

-- links a new sign-up to its invitation
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email);
  if found then
    insert into public.staff_members (user_id, email, name, role)
    values (new.id, new.email, coalesce(inv.name, split_part(new.email, '@', 1)), inv.role)
    on conflict (user_id) do nothing;
    delete from public.staff_invites where lower(email) = lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "staff read team" on public.staff_members;
create policy "staff read team" on public.staff_members for select to authenticated using (public.is_staff());
drop policy if exists "admin manage team" on public.staff_members;
create policy "admin manage team" on public.staff_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage invites" on public.staff_invites;
create policy "admin manage invites" on public.staff_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Editable content: one document per area, draft + published
-- ---------------------------------------------------------
create table if not exists public.site_content (
  key              text primary key,
  draft            jsonb not null default '{}'::jsonb,
  published        jsonb not null default '{}'::jsonb,
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid,
  published_at     timestamptz,
  published_by     uuid
);
alter table public.site_content enable row level security;

-- staff may only touch these documents; everything else is admin-only
create or replace function public.may_edit(doc_key text) returns boolean
language sql stable as $$
  select public.is_admin() or (public.is_staff() and doc_key in ('products', 'gallery'));
$$;

drop policy if exists "staff read content" on public.site_content;
create policy "staff read content" on public.site_content for select to authenticated using (public.is_staff());
drop policy if exists "edit allowed docs" on public.site_content;
create policy "edit allowed docs" on public.site_content for update to authenticated
  using (public.may_edit(key)) with check (public.may_edit(key));

-- the website build reads only published documents
create or replace view public.published_content
with (security_invoker = off) as
  select key, published as doc from public.site_content;
grant select on public.published_content to anon, authenticated;

create table if not exists public.content_versions (
  id       bigserial primary key,
  key      text not null,
  doc      jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid,
  note     text
);
alter table public.content_versions enable row level security;
drop policy if exists "staff read versions" on public.content_versions;
create policy "staff read versions" on public.content_versions for select to authenticated using (public.is_staff());

create table if not exists public.publish_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  by      uuid,
  keys    text[] not null,
  note    text
);
alter table public.publish_log enable row level security;
drop policy if exists "staff read publishes" on public.publish_log;
create policy "staff read publishes" on public.publish_log for select to authenticated using (public.is_staff());

-- settings only the database needs (deploy hook URL); never exposed to the site
create table if not exists public.app_config (
  key   text primary key,
  value text
);
alter table public.app_config enable row level security;
drop policy if exists "admin config" on public.app_config;
create policy "admin config" on public.app_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Publishing: copy drafts to published, keep a version, trigger a rebuild
-- ---------------------------------------------------------
create or replace function public.publish_content(keys text[], note text default null)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare k text; hook text; at timestamptz := now();
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  foreach k in array keys loop
    if not public.may_edit(k) then
      raise exception 'not allowed to publish %', k using errcode = '42501';
    end if;
  end loop;

  insert into public.content_versions (key, doc, saved_by, note)
    select key, published, auth.uid(), 'before publish'
    from public.site_content where key = any (keys) and published <> '{}'::jsonb;

  update public.site_content
     set published = draft, published_at = at, published_by = auth.uid()
   where key = any (keys);

  insert into public.publish_log (by, keys, note) values (auth.uid(), keys, note);

  -- tell the host to rebuild, if a deploy hook has been configured
  select value into hook from public.app_config where key = 'deploy_hook_url';
  if hook is not null and hook <> '' then
    perform net.http_post(url := hook, body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;

  return at;
end $$;
revoke all on function public.publish_content(text[], text) from public;
grant execute on function public.publish_content(text[], text) to authenticated;

-- restore an older version into the draft (publishing it stays a separate step)
create or replace function public.restore_version(version_id bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare v public.content_versions;
begin
  select * into v from public.content_versions where id = version_id;
  if not found then raise exception 'no such version'; end if;
  if not public.may_edit(v.key) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.site_content
     set draft = v.doc, draft_updated_at = now(), draft_updated_by = auth.uid()
   where key = v.key;
  return v.key;
end $$;
revoke all on function public.restore_version(bigint) from public;
grant execute on function public.restore_version(bigint) to authenticated;

-- ---------------------------------------------------------
-- Media uploaded from the admin panel (public, it appears on the website)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read site media" on storage.objects;
create policy "public read site media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-media');
drop policy if exists "staff write site media" on storage.objects;
create policy "staff write site media" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_staff());
drop policy if exists "staff update site media" on storage.objects;
create policy "staff update site media" on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_staff());
drop policy if exists "admin delete site media" on storage.objects;
create policy "admin delete site media" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

-- staff can view customers' private reference images
drop policy if exists "staff read references" on storage.objects;
create policy "staff read references" on storage.objects for select to authenticated
  using (bucket_id = 'references' and public.is_staff());

-- ---------------------------------------------------------
-- Enquiries: staff work them, only an admin may delete
-- ---------------------------------------------------------
drop policy if exists "staff read enquiries" on public.enquiries;
create policy "staff read enquiries" on public.enquiries for select to authenticated using (public.is_staff());
drop policy if exists "staff update enquiries" on public.enquiries;
create policy "staff update enquiries" on public.enquiries for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists "admin delete enquiries" on public.enquiries;
create policy "admin delete enquiries" on public.enquiries for delete to authenticated using (public.is_admin());

-- live updates in the enquiries inbox
do $$ begin
  alter publication supabase_realtime add table public.enquiries;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------
-- submit_enquiry now checks the product against published content
-- ---------------------------------------------------------
create or replace function public.product_exists(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.site_content sc,
         lateral jsonb_array_elements(case when jsonb_typeof(sc.published) = 'array' then sc.published else '[]'::jsonb end) e
     where sc.key = 'products' and e->>'id' = pid and coalesce((e->>'visible')::boolean, true)
  );
$$;
