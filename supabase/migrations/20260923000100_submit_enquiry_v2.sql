-- =========================================================
-- submit_enquiry v2: products are validated against the published
-- products document instead of a hard-coded list, so a product added
-- in the admin panel can be quoted straight away.
-- =========================================================

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

  -- the product must be one that is published and visible on the site
  if not public.product_exists(coalesce(p->>'product', '')) then
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
