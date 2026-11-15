-- =========================================================
-- Payments received, recorded per enquiry in the studio panel
--
-- There is no payment gateway: customers pay by UPI or bank transfer from
-- the /pay page and send a screenshot on WhatsApp. The studio checks the
-- money has arrived in the bank, then records it here.
-- =========================================================

alter table public.enquiries
  add column if not exists amount_received numeric(12, 2),
  add column if not exists received_at     timestamptz;

comment on column public.enquiries.amount_received is
  'Total the studio has confirmed in its bank account for this enquiry';

-- stamp the date whenever the amount received changes
create or replace function public.stamp_received_at() returns trigger
language plpgsql as $$
begin
  if new.amount_received is distinct from old.amount_received then
    new.received_at := case when coalesce(new.amount_received, 0) > 0 then now() end;
  end if;
  return new;
end $$;

drop trigger if exists enquiries_received_at on public.enquiries;
create trigger enquiries_received_at before update on public.enquiries
  for each row execute function public.stamp_received_at();
