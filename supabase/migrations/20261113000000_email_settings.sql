-- =========================================================
-- Email settings, managed from the studio panel (Emails screen)
--
-- * notify_email may now hold several addresses, separated by commas.
-- * customer_confirmations ('on' / 'off') switches the customer's
--   confirmation email without losing the sender address in customer_from.
-- * send_test_email() lets an admin check the whole chain from the panel,
--   and email_test_result() reports what Resend said.
-- =========================================================

insert into public.app_config (key, value) values
  ('customer_confirmations', 'off')
on conflict (key) do nothing;

-- the alert recipients as a JSON array: 'a@x.in, b@y.in' -> ["a@x.in","b@y.in"]
create or replace function public.notify_recipients() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(addr), '[]'::jsonb)
    from (select trim(a) as addr
            from app_config, regexp_split_to_table(value, '[,;\s]+') a
           where key = 'notify_email' and trim(a) like '%_@_%') t;
$$;
revoke all on function public.notify_recipients() from public, anon, authenticated;

create or replace function public.notify_new_enquiry() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  api_key text; recipients jsonb; from_addr text; cust_from text; cust_on text; mail jsonb;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select value into from_addr from app_config where key = 'email_from';
  select value into cust_from from app_config where key = 'customer_from';
  select value into cust_on   from app_config where key = 'customer_confirmations';
  recipients := notify_recipients();
  if api_key is null then return new; end if;

  -- 1. studio alert, to everyone on the list
  if jsonb_array_length(recipients) > 0 then
    mail := enquiry_alert_email(new);
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object('from', from_addr, 'to', recipients,
                                    'reply_to', nullif(new.email, ''), 'subject', mail->>'subject', 'html', mail->>'html'));
  end if;

  -- 2. customer confirmation: switched on in the panel, from a verified address
  if coalesce(cust_on, 'off') = 'on' and coalesce(cust_from, '') <> '' and coalesce(new.email, '') <> '' then
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

-- An admin presses "Send test email". Returns the request id to check on.
-- which: 'alert' (to the alert list) or 'confirmation' (to the admin's own
-- address, from the customer sender, so the confirmation can be previewed).
create or replace function public.send_test_email(which text default 'alert')
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  api_key text; from_addr text; to_list jsonb; me text; req bigint; subject text; html text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null then raise exception 'No Resend key is saved yet'; end if;
  select email into me from auth.users where id = auth.uid();

  if which = 'confirmation' then
    select value into from_addr from app_config where key = 'customer_from';
    if coalesce(from_addr, '') = '' then raise exception 'Add the customer sender address first'; end if;
    to_list := jsonb_build_array(me);
    subject := 'Test: customer confirmation';
    html := '<p>This is how customers'' confirmation emails will arrive, from ' || h(from_addr) || '.</p>';
  else
    select value into from_addr from app_config where key = 'email_from';
    to_list := notify_recipients();
    if jsonb_array_length(to_list) = 0 then raise exception 'Add at least one address to send alerts to'; end if;
    subject := 'Test: new enquiry alerts are working';
    html := '<p>Enquiry alerts from your website will arrive like this. Sent from the studio panel by ' || h(me) || '.</p>';
  end if;

  select net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object('from', from_addr, 'to', to_list, 'subject', subject, 'html', html)) into req;
  return req;
end $$;
revoke all on function public.send_test_email(text) from public, anon;
grant execute on function public.send_test_email(text) to authenticated;

-- What Resend answered for a test: null while waiting, then {ok, status, message}
create or replace function public.email_test_result(request_id bigint)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select status_code, content, error_msg into r from net._http_response where id = request_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'ok', r.status_code between 200 and 299,
    'status', r.status_code,
    'message', coalesce(r.error_msg, (r.content::jsonb ->> 'message'), ''));
exception when others then
  return jsonb_build_object('ok', false, 'status', r.status_code, 'message', coalesce(r.error_msg, left(r.content, 300), ''));
end $$;
revoke all on function public.email_test_result(bigint) from public, anon;
grant execute on function public.email_test_result(bigint) to authenticated;
