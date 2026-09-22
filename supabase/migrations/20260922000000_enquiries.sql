-- =========================================================
-- Mynséra enquiries
-- One row per quote request, holding everything the studio needs:
-- product + requirements, quantity, budget, date, location, contact,
-- reference images (private storage) and the estimate the customer saw.
--
-- The website (publishable key) can only:
--   * upload images into references/incoming/<session>/...
--   * call submit_enquiry(payload), which validates and inserts
-- It cannot read, list, update or delete anything.
-- =========================================================

create extension if not exists pgcrypto;

create sequence if not exists public.enquiry_ref_seq start 1001;

create table if not exists public.enquiries (
  id              uuid primary key default gen_random_uuid(),
  ref             text unique not null default ('MYN-' || nextval('public.enquiry_ref_seq')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- pipeline, ready for a CRM / quotation / payment flow later
  status          text not null default 'new'
                  check (status in ('new','reviewing','quoted','confirmed','in_production','dispatched','completed','lost','spam')),
  quoted_amount   integer,
  internal_notes  text,

  -- what
  product         text not null,
  variant         text,
  tier            text,
  size            text,
  size_custom     text,
  shape           text,
  material        text,
  finishes        text[] not null default '{}',
  colours         text[] not null default '{}',
  colour_notes    text,
  notes           text,
  quantity        integer not null check (quantity between 1 and 100000),
  budget          text,

  -- when / where
  occasion        text,
  event_date      date,
  date_flexible   boolean not null default false,
  location        text,
  rush            boolean not null default false,

  -- who
  name            text not null,
  phone           text not null,
  whatsapp        text,
  email           text,
  contact_pref    text,
  consent         boolean not null,

  -- inspiration
  reference_paths text[] not null default '{}',   -- private files in storage bucket "references"
  gallery_refs    text[] not null default '{}',   -- photos of our own work they picked

  -- estimate exactly as shown to the customer (approximate, not a quote)
  estimate_low    integer,
  estimate_high   integer,
  estimate_lines  jsonb not null default '[]',

  source          jsonb not null default '{}'
);

create index if not exists enquiries_created_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx  on public.enquiries (status);
create index if not exists enquiries_phone_idx   on public.enquiries (phone, created_at desc);

alter table public.enquiries enable row level security;
-- no policies for anon/authenticated: the table is only reachable through
-- submit_enquiry() and the Supabase dashboard (service role).

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists enquiries_touch on public.enquiries;
create trigger enquiries_touch before update on public.enquiries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- Storage: private bucket for reference images
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('references', 'references', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site can upload references" on storage.objects;
create policy "site can upload references" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'references'
    and (storage.foldername(name))[1] = 'incoming'
    and array_length(storage.foldername(name), 1) = 2
  );

-- ---------------------------------------------------------
-- submit_enquiry: the only way in from the website
-- ---------------------------------------------------------
create or replace function public.submit_enquiry(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p          jsonb := coalesce(payload, '{}'::jsonb);
  v_phone    text  := left(trim(coalesce(p->>'phone', '')), 30);
  v_digits   text  := regexp_replace(v_phone, '\D', '', 'g');
  v_email    text  := lower(left(trim(coalesce(p->>'email', '')), 200));
  v_qty      integer;
  v_date     date;
  v_paths    text[];
  v_ref      text;
begin
  -- honeypot: bots fill every field. Pretend success, store nothing.
  if coalesce(p->>'website', '') <> '' then
    return 'MYN-0000';
  end if;

  if coalesce(p->>'product', '') not in ('invitations','bouquets','boutonnieres','banners','pinata','props','hymnals','ring-holders','return-gifts','cake-toppers') then
    raise exception 'invalid product' using errcode = '22023';
  end if;
  if length(trim(coalesce(p->>'name', ''))) < 2 then
    raise exception 'name required' using errcode = '22023';
  end if;
  if length(v_digits) not between 10 and 15 then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'consent required' using errcode = '22023';
  end if;

  begin
    v_qty := (p->>'quantity')::integer;
  exception when others then
    raise exception 'invalid quantity' using errcode = '22023';
  end;
  if v_qty is null or v_qty not between 1 and 100000 then
    raise exception 'invalid quantity' using errcode = '22023';
  end if;

  if nullif(p->>'event_date', '') is not null then
    begin
      v_date := (p->>'event_date')::date;
    exception when others then
      raise exception 'invalid date' using errcode = '22023';
    end;
  end if;

  -- rate limit: 5 enquiries per phone number per 24h
  if (select count(*) from public.enquiries
      where regexp_replace(phone, '\D', '', 'g') = v_digits
        and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  -- keep only reference paths that were really uploaded through the site
  select coalesce(array_agg(o.name), '{}') into v_paths
  from storage.objects o
  where o.bucket_id = 'references'
    and o.name = any (
      array(select jsonb_array_elements_text(coalesce(p->'reference_paths', '[]'::jsonb)))
    )
    and o.name like 'incoming/%';

  insert into public.enquiries (
    product, variant, tier, size, size_custom, shape, material, finishes, colours, colour_notes, notes,
    quantity, budget, occasion, event_date, date_flexible, location, rush,
    name, phone, whatsapp, email, contact_pref, consent,
    reference_paths, gallery_refs, estimate_low, estimate_high, estimate_lines, source
  ) values (
    p->>'product',
    nullif(left(p->>'variant', 60), ''),
    nullif(left(p->>'tier', 60), ''),
    nullif(left(p->>'size', 60), ''),
    nullif(left(p->>'size_custom', 80), ''),
    nullif(left(p->>'shape', 60), ''),
    nullif(left(p->>'material', 60), ''),
    array(select left(x, 60) from jsonb_array_elements_text(coalesce(p->'finishes', '[]'::jsonb)) x limit 12),
    array(select left(x, 40) from jsonb_array_elements_text(coalesce(p->'colours', '[]'::jsonb)) x limit 12),
    nullif(left(p->>'colour_notes', 200), ''),
    nullif(left(p->>'notes', 2000), ''),
    v_qty,
    nullif(left(p->>'budget', 60), ''),
    nullif(left(p->>'occasion', 60), ''),
    v_date,
    coalesce((p->>'date_flexible')::boolean, false),
    nullif(left(trim(p->>'location'), 160), ''),
    coalesce((p->>'rush')::boolean, false),
    left(trim(p->>'name'), 120),
    v_phone,
    nullif(left(trim(p->>'whatsapp'), 30), ''),
    v_email,
    nullif(left(p->>'contact_pref', 30), ''),
    true,
    v_paths,
    array(select left(x, 120) from jsonb_array_elements_text(coalesce(p->'gallery_refs', '[]'::jsonb)) x limit 5),
    nullif(p->>'estimate_low', '')::integer,
    nullif(p->>'estimate_high', '')::integer,
    coalesce(p->'estimate_lines', '[]'::jsonb),
    coalesce(p->'source', '{}'::jsonb)
  )
  returning ref into v_ref;

  return v_ref;
end;
$$;

revoke all on function public.submit_enquiry(jsonb) from public;
grant execute on function public.submit_enquiry(jsonb) to anon, authenticated;
