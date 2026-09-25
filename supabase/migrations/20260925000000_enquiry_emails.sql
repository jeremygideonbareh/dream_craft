-- =========================================================
-- Enquiry emails (Resend)
--
-- Every new enquiry sends the studio an alert with the full details.
-- Once a verified sender exists (the mynsera.in domain), the customer
-- also gets an automatic confirmation.
--
-- The Resend API key lives in Supabase Vault as 'resend_api_key' and is
-- never stored in this repository. Settings live in app_config:
--   notify_email    who receives the studio alert
--   email_from      sender for the studio alert
--   customer_from   sender for customer confirmations (empty = off)
--   admin_url       link to the studio panel, used in the alert
--
-- Sending happens through pg_net, which is asynchronous: an email that
-- fails can never slow down or lose an enquiry.
-- =========================================================

insert into public.app_config (key, value) values
  ('notify_email',  ''),
  ('email_from',    'Mynsera Studio <onboarding@resend.dev>'),
  ('customer_from', ''),
  ('admin_url',     'https://jeremygideonbareh.github.io/dream_craft/admin/')
on conflict (key) do nothing;

-- escape text for an HTML email
create or replace function public.h(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- the label the customer saw for a stored choice, e.g. '5x7' -> '5 × 7 in'
create or replace function public.choice_label(prod jsonb, field text, val text) returns text
language sql stable as $$
  select coalesce(
    (select c->>'label' from jsonb_array_elements(coalesce(prod->field, '[]'::jsonb)) c where c->>'value' = val limit 1),
    val);
$$;

-- the studio alert for one enquiry, as {subject, html}; kept separate from
-- the trigger so an email can be previewed without sending it
create or replace function public.enquiry_alert_email(e public.enquiries) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  prod jsonb; title text; tier text; details text; when_text text; row_html text; admin_url text;
begin
  select value into admin_url from app_config where key = 'admin_url';
  select x into prod
    from site_content sc, jsonb_array_elements(sc.published) x
   where sc.key = 'products' and x->>'id' = e.product;
  title := coalesce(prod->>'title', e.product);
  tier := case e.tier
            when 'custom' then 'Fully custom'
            when 'unsure' then 'Wants help choosing a package'
            else (select x->>'name' || ' package'
                    from site_content sc, jsonb_array_elements(sc.published->'packages') x
                   where sc.key = 'pricing' and x->>'id' = e.tier) end;

  -- everything they chose, in the words they saw on the form
  details := concat_ws(' · ',
    nullif(tier, ''),
    nullif(choice_label(prod, 'variants', e.variant), ''),
    case when e.size = 'custom' then 'Custom size: ' || e.size_custom else nullif(choice_label(prod, 'sizes', e.size), '') end,
    nullif(choice_label(prod, 'shapes', e.shape), ''),
    nullif(choice_label(prod, 'materials', e.material), ''),
    nullif((select string_agg(choice_label(prod, 'finishes', f), ', ') from unnest(e.finishes) f), ''),
    nullif(array_to_string(e.colours, ', '), ''),
    nullif(e.colour_notes, ''));
  when_text := coalesce(e.occasion, 'Event') || ' · ' ||
    case when e.date_flexible or e.event_date is null then 'date not fixed'
         else to_char(e.event_date, 'FMDD Mon YYYY') end ||
    case when e.rush then ' · RUSH' else '' end;
  row_html := $r$<tr><td style="padding:6px 12px 6px 0;color:#6B564A;font-size:13px;white-space:nowrap;vertical-align:top">%s</td><td style="padding:6px 0;font-size:14px;color:#33241B">%s</td></tr>$r$;

  return jsonb_build_object(
    'subject', format('New enquiry %s · %s × %s · %s', e.ref, title, e.quantity, e.name),
    'html', format($html$
<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#33241B">
  <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#B85C38;margin:0 0 6px">New enquiry</p>
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 4px">%s · %s</h1>
  <p style="margin:0 0 18px;color:#6B564A">%s × %s%s</p>
  <table style="border-collapse:collapse;width:100%%">%s%s%s%s%s%s%s%s</table>
  <p style="margin:22px 0">
    <a href="%s" style="background:#B85C38;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:13px;letter-spacing:1px">Open in the studio panel</a>
  </p>
  <p style="font-size:12px;color:#6B564A">%s. Reply to this email to answer the customer directly.</p>
</div>$html$,
      h(e.ref), h(e.name),
      e.quantity, h(title),
      case when e.estimate_low is not null
           then format(' · estimate shown ₹%s – ₹%s', to_char(e.estimate_low, 'FM99,99,99,999'), to_char(e.estimate_high, 'FM99,99,99,999'))
           else '' end,
      format(row_html, 'Details', h(coalesce(nullif(details, ''), '—'))),
      format(row_html, 'Budget',  h(coalesce(e.budget, '—'))),
      format(row_html, 'When',    h(when_text)),
      format(row_html, 'Where',   h(coalesce(e.location, '—'))),
      format(row_html, 'Phone',   h(e.phone) || case when coalesce(e.whatsapp, '') <> '' and e.whatsapp <> e.phone then ' · WhatsApp ' || h(e.whatsapp) else '' end),
      format(row_html, 'Email',   h(coalesce(e.email, '—')) || ' · prefers ' || h(coalesce(e.contact_pref, '—'))),
      format(row_html, 'Images',  (cardinality(e.reference_paths) + cardinality(e.gallery_refs))::text || ' attached (view in the panel)'),
      format(row_html, 'Notes',   h(coalesce(e.notes, '—'))),
      h(admin_url),
      case when cardinality(e.reference_paths) > 0 then 'Their photos are private and open from the panel' else 'No photos were uploaded' end));
end $$;

-- the customer's confirmation, as {subject, html}
create or replace function public.enquiry_confirmation_email(e public.enquiries) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare title text;
begin
  select x->>'title' into title
    from site_content sc, jsonb_array_elements(sc.published) x
   where sc.key = 'products' and x->>'id' = e.product;
  return jsonb_build_object(
    'subject', format('We have your enquiry · %s', e.ref),
    'html', format($html$
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#33241B">
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px">Thank you, %s</h1>
  <p>We've received your enquiry for <b>%s</b>. Your reference is <b style="color:#B85C38">%s</b>.</p>
  <p>We'll look at your inspiration and details, then send you a written quotation. The price range you saw on the website is approximate; your quotation confirms the final price.</p>
  <p style="color:#6B564A;font-size:13px">If anything changes, just reply to this email and quote your reference.</p>
</div>$html$,
      h(split_part(e.name, ' ', 1)), h(coalesce(title, e.product)), h(e.ref)));
end $$;

-- nobody outside the database may call these (they read private content)
revoke all on function public.enquiry_alert_email(public.enquiries) from public, anon, authenticated;
revoke all on function public.enquiry_confirmation_email(public.enquiries) from public, anon, authenticated;

create or replace function public.notify_new_enquiry() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  api_key text; to_addr text; from_addr text; cust_from text; mail jsonb;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select value into to_addr   from app_config where key = 'notify_email';
  select value into from_addr from app_config where key = 'email_from';
  select value into cust_from from app_config where key = 'customer_from';
  if api_key is null then return new; end if;

  -- 1. studio alert
  if coalesce(to_addr, '') <> '' then
    mail := enquiry_alert_email(new);
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object('from', from_addr, 'to', jsonb_build_array(to_addr),
                                    'reply_to', nullif(new.email, ''), 'subject', mail->>'subject', 'html', mail->>'html'));
  end if;

  -- 2. customer confirmation: only once a verified sending domain exists
  if coalesce(cust_from, '') <> '' and coalesce(new.email, '') <> '' then
    mail := enquiry_confirmation_email(new);
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object('from', cust_from, 'to', jsonb_build_array(new.email),
                                    'subject', mail->>'subject', 'html', mail->>'html'));
  end if;

  return new;
exception when others then
  return new;   -- an email problem must never lose an enquiry
end $$;

drop trigger if exists enquiries_notify on public.enquiries;
create trigger enquiries_notify after insert on public.enquiries
  for each row execute function public.notify_new_enquiry();
