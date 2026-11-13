<script lang="ts">
  /* Admin only: who gets enquiry alerts, who they come from, and the customer's
     confirmation email. Settings live in app_config; sending is done by the
     database (Resend), see supabase/migrations/*email*.sql. */
  import { sb, toast } from './store.svelte';

  const KEYS = ['notify_email', 'email_from', 'customer_from', 'customer_confirmations'] as const;
  const TEST_SENDER = 'onboarding@resend.dev';

  let loading = $state(true);
  let saving = $state(false);
  let ready = $state(true);          // the database has the email functions
  let alertsTo = $state('');
  let fromName = $state('');
  let fromAddr = $state('');
  let custOn = $state(false);
  let custName = $state('');
  let custAddr = $state('');
  let saved = $state('');
  let test = $state<{ which: string; state: 'sending' | 'ok' | 'fail'; message: string } | null>(null);

  // "Mynséra Studio <hello@mynsera.in>" <-> name + address
  const split = (v: string) => {
    const m = v.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    return m ? { name: m[1], addr: m[2] } : { name: '', addr: v.trim() };
  };
  const join = (name: string, addr: string) => (addr.trim() ? (name.trim() ? `${name.trim()} <${addr.trim()}>` : addr.trim()) : '');
  const emails = (v: string) => v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const valid = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e);

  const current = () => JSON.stringify([alertsTo, fromName, fromAddr, custOn, custName, custAddr]);
  const dirty = $derived(current() !== saved);
  const usingTestSender = $derived(fromAddr.trim().toLowerCase() === TEST_SENDER);

  async function load() {
    loading = true;
    const { data, error } = await sb.from('app_config').select('key, value').in('key', [...KEYS]);
    if (error) { toast(error.message); loading = false; return; }
    const v = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
    alertsTo = emails(v.notify_email ?? '').join(', ');
    ({ name: fromName, addr: fromAddr } = split(v.email_from ?? ''));
    ({ name: custName, addr: custAddr } = split(v.customer_from ?? ''));
    custOn = v.customer_confirmations === 'on' || (v.customer_confirmations === undefined && !!v.customer_from);
    // older databases don't have the test functions yet
    const probe = await sb.rpc('email_test_result', { request_id: -1 });
    ready = !probe.error || !/could not find|does not exist|schema cache/i.test(probe.error.message);
    saved = current();
    loading = false;
  }
  load();

  async function save() {
    const list = emails(alertsTo);
    const bad = list.find((e) => !valid(e));
    if (bad) { toast(`"${bad}" isn't a valid email address`); return; }
    if (!ready && list.length > 1) { toast('Only one alert address works until the database update is applied'); return; }
    if (!valid(fromAddr.trim())) { toast('Enter the address alerts are sent from'); return; }
    if (custOn && !valid(custAddr.trim())) { toast('Enter the address confirmations are sent from'); return; }
    saving = true;
    const rows = [
      { key: 'notify_email', value: list.join(', ') },
      { key: 'email_from', value: join(fromName, fromAddr) },
      // before the database update, an empty sender is what switches confirmations off
      { key: 'customer_from', value: ready || custOn ? join(custName, custAddr) : '' },
      { key: 'customer_confirmations', value: custOn ? 'on' : 'off' },
    ];
    const { error } = await sb.from('app_config').upsert(rows);
    saving = false;
    if (error) { toast(error.message); return; }
    saved = current();
    toast('Email settings saved. They apply to the next enquiry.');
  }

  async function sendTest(which: 'alert' | 'confirmation') {
    if (dirty) { toast('Save your changes first'); return; }
    test = { which, state: 'sending', message: '' };
    const { data: id, error } = await sb.rpc('send_test_email', { which });
    if (error) { test = { which, state: 'fail', message: error.message }; return; }
    // the email is sent in the background; ask for Resend's answer for ~20s
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const { data } = await sb.rpc('email_test_result', { request_id: id });
      if (data) {
        test = data.ok
          ? { which, state: 'ok', message: which === 'alert' ? `Sent to ${emails(alertsTo).join(', ')}. Check the inbox (and Spam).` : 'Sent to your own address. Check the inbox (and Spam).' }
          : { which, state: 'fail', message: explain(data.message) };
        return;
      }
    }
    test = { which, state: 'fail', message: 'No answer from the email service yet. Check the inbox in a minute.' };
  }

  // Resend's messages, in plain words
  function explain(m: string) {
    if (/verify a domain|own email address|testing emails/i.test(m)) return 'Resend only sends to the account owner until mynsera.in is verified. ' + m;
    if (/not verified|domain is not/i.test(m)) return 'That sender address is on a domain Resend hasn\'t verified yet. ' + m;
    if (/api key/i.test(m)) return 'The Resend key saved in the database was rejected. It may have been changed. ' + m;
    return m || 'The email service refused the email.';
  }
</script>

<header class="screen__head">
  <div>
    <h2>Emails</h2>
    <p class="muted">Who is told about new enquiries, and what customers receive. Emails are sent through Resend.</p>
  </div>
  <div class="screen__tools">
    <button class="btn btn--sm btn--go" onclick={save} disabled={saving || loading || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
  </div>
</header>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  {#if !ready}
    <p class="notice notice--warn">This screen is waiting for a one-time database update from your developer. Until then you can change the alert address and sender, but not test emails, several recipients or customer confirmations.</p>
  {/if}

  <div class="card">
    <h4>New enquiry alerts</h4>
    <p class="muted">Every enquiry from the quote form is emailed here, with all its details and a button to open it in this panel. Replying to the email replies to the customer.</p>
    <label class="f">
      <span>Send alerts to</span>
      <input bind:value={alertsTo} placeholder="studio@example.com" autocomplete="off" />
      {#if ready}<small class="f__hint">Several people? Separate the addresses with commas.</small>{/if}
    </label>
    <div class="fld-2">
      <label class="f"><span>Sender name</span><input bind:value={fromName} placeholder="Mynséra Studio" /></label>
      <label class="f"><span>Sender address</span><input bind:value={fromAddr} placeholder="hello@mynsera.in" autocomplete="off" /></label>
    </div>
    {#if usingTestSender}
      <p class="notice">Using Resend's test sender. Alerts can only go to the Resend account's own address (mynsera@gmail.com) and may land in Spam. Once mynsera.in is verified in Resend, change the sender to an address like hello@mynsera.in.</p>
    {/if}
    {#if ready}
      <div class="email-test">
        <button class="btn btn--sm btn--ghost" onclick={() => sendTest('alert')} disabled={test?.state === 'sending'}>Send a test alert</button>
        {#if test?.which === 'alert'}<span class:ok={test.state === 'ok'} class:fail={test.state === 'fail'}>{test.state === 'sending' ? 'Sending…' : test.message}</span>{/if}
      </div>
    {/if}
  </div>

  <div class="card" class:is-off={!ready}>
    <h4>Confirmation to the customer</h4>
    <p class="muted">An email to the customer as soon as they send an enquiry, with their reference number. It needs a sender address on a domain verified in Resend (mynsera.in).</p>
    <label class="f f--row">
      <span>Send customers a confirmation</span>
      <input type="checkbox" bind:checked={custOn} disabled={!ready} />
    </label>
    <div class="fld-2">
      <label class="f"><span>Sender name</span><input bind:value={custName} placeholder="Mynséra" disabled={!ready} /></label>
      <label class="f"><span>Sender address</span><input bind:value={custAddr} placeholder="hello@mynsera.in" autocomplete="off" disabled={!ready} /></label>
    </div>
    {#if ready && custAddr.trim()}
      <div class="email-test">
        <button class="btn btn--sm btn--ghost" onclick={() => sendTest('confirmation')} disabled={test?.state === 'sending'}>Send a test to me</button>
        {#if test?.which === 'confirmation'}<span class:ok={test.state === 'ok'} class:fail={test.state === 'fail'}>{test.state === 'sending' ? 'Sending…' : test.message}</span>{/if}
      </div>
    {/if}
  </div>
{/if}
