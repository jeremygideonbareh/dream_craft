<script lang="ts">
  /* The inbox: every enquiry with its images, requirements and contact details. */
  import {
    app, sb, listEnquiries, updateEnquiry, deleteEnquiry, signedRefs, isAdmin,
    STATUSES, fmtDate, fmtWhen, toast, type Enquiry,
  } from './store.svelte';

  let items = $state<Enquiry[]>([]);
  let loading = $state(true);
  let status = $state('');
  let product = $state('');
  let search = $state('');
  let open = $state<Enquiry | null>(null);
  let refs = $state<string[]>([]);
  let notes = $state('');
  let quoted = $state<number | null>(null);

  const products = $derived((app.docs.products?.draft ?? []) as { id: string; title: string }[]);
  const gallery = $derived((app.docs.gallery?.draft ?? []) as { id: string; title: string }[]);
  const titleOf = (id: string) => products.find((p) => p.id === id)?.title ?? id;
  const galleryTitle = (id: string) => gallery.find((g) => g.id === id)?.title ?? id;
  const label = (s: string) => s.replace(/_/g, ' ');

  async function load() {
    loading = true;
    items = await listEnquiries({ status, product, search });
    loading = false;
  }
  load();

  // live: a new enquiry appears while the studio is looking at the list
  $effect(() => {
    const channel = sb
      .channel('enquiries-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enquiries' }, (payload) => {
        items = [payload.new as Enquiry, ...items];
        toast('New enquiry just arrived');
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  });

  async function openOne(e: Enquiry) {
    open = e;
    notes = e.internal_notes ?? '';
    quoted = e.quoted_amount;
    refs = await signedRefs(e.reference_paths);
  }

  async function setStatus(e: Enquiry, s: string) {
    const before = e.status;
    e.status = s;
    if (!(await updateEnquiry(e.id, { status: s }))) e.status = before;
  }
  async function saveDetail() {
    if (!open) return;
    if (await updateEnquiry(open.id, { internal_notes: notes, quoted_amount: quoted })) {
      open.internal_notes = notes;
      open.quoted_amount = quoted;
      toast('Saved');
    }
  }
  async function remove(e: Enquiry) {
    if (!confirm(`Delete ${e.ref}? This cannot be undone.`)) return;
    if (await deleteEnquiry(e.id)) {
      items = items.filter((x) => x.id !== e.id);
      open = null;
      toast('Deleted');
    }
  }

  function csv() {
    const cols = ['ref', 'created_at', 'status', 'product', 'quantity', 'budget', 'occasion', 'event_date', 'location', 'name', 'phone', 'whatsapp', 'email', 'estimate_low', 'estimate_high', 'quoted_amount'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = [cols.join(','), ...items.map((e) => cols.map((c) => esc((e as any)[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const waLink = (e: Enquiry) => {
    const n = (e.whatsapp || e.phone).replace(/\D/g, '');
    return `https://wa.me/${n.length === 10 ? '91' + n : n}?text=${encodeURIComponent(`Hi ${e.name.split(' ')[0]}, thank you for your enquiry ${e.ref} with us.`)}`;
  };
  const detail = (e: Enquiry) =>
    [e.tier, e.variant, e.size === 'custom' ? e.size_custom : e.size, e.shape, e.material, ...e.finishes, ...e.colours, e.colour_notes]
      .filter(Boolean).join(' · ') || '—';
</script>

<header class="screen__head">
  <div>
    <h2>Enquiries</h2>
    <p class="muted">{items.length} shown{status ? ` · ${label(status)}` : ''}</p>
  </div>
  <div class="screen__tools">
    <button class="btn btn--sm btn--ghost" onclick={csv} disabled={!items.length}>Export CSV</button>
    <button class="btn btn--sm btn--ghost" onclick={load}>Refresh</button>
  </div>
</header>

<div class="filters">
  <input class="search" placeholder="Search name, reference, phone or email" bind:value={search} onchange={load} />
  <select bind:value={status} onchange={load}>
    <option value="">All statuses</option>
    {#each STATUSES as s}<option value={s}>{label(s)}</option>{/each}
  </select>
  <select bind:value={product} onchange={load}>
    <option value="">All products</option>
    {#each products as p}<option value={p.id}>{p.title}</option>{/each}
  </select>
</div>

{#if loading}
  <p class="muted">Loading…</p>
{:else if !items.length}
  <p class="empty">No enquiries yet. They appear here the moment someone sends one.</p>
{:else}
  <ul class="rows">
    {#each items as e (e.id)}
      <li class="row" class:is-new={e.status === 'new'}>
        <button class="row__main" onclick={() => openOne(e)}>
          <span class="row__ref">{e.ref}</span>
          <span class="row__name">{e.name}</span>
          <span class="row__what">{titleOf(e.product)} · {e.quantity}</span>
          <span class="row__when">{fmtWhen(e.created_at)}</span>
          {#if e.rush}<span class="tag tag--rush">rush</span>{/if}
          {#if e.reference_paths.length || e.gallery_refs.length}<span class="tag">{e.reference_paths.length + e.gallery_refs.length} img</span>{/if}
        </button>
        <select class="row__status" value={e.status} onchange={(ev) => setStatus(e, (ev.target as HTMLSelectElement).value)}>
          {#each STATUSES as s}<option value={s}>{label(s)}</option>{/each}
        </select>
      </li>
    {/each}
  </ul>
{/if}

{#if open}
  <div class="modal" role="dialog" aria-label="Enquiry {open.ref}">
    <div class="modal__box modal__box--wide">
      <div class="modal__head">
        <h3>{open.ref} · {open.name}</h3>
        <button class="ico" onclick={() => (open = null)}>×</button>
      </div>

      <div class="detail">
        <div class="detail__imgs">
          {#each refs as r}<a href={r} target="_blank" rel="noopener"><img src={r} alt="Reference" /></a>{/each}
          {#each open.gallery_refs as g}<span class="tag">our work: {galleryTitle(g)}</span>{/each}
          {#if !refs.length && !open.gallery_refs.length}<p class="muted">No images attached.</p>{/if}
        </div>

        <dl class="detail__list">
          <div><dt>Making</dt><dd>{titleOf(open.product)} · {open.quantity}</dd></div>
          <div><dt>Details</dt><dd>{detail(open)}</dd></div>
          <div><dt>Budget</dt><dd>{open.budget ?? '—'}</dd></div>
          <div><dt>Occasion</dt><dd>{open.occasion ?? '—'} · {open.date_flexible ? 'date not fixed' : fmtDate(open.event_date)}{open.rush ? ' · RUSH' : ''}</dd></div>
          <div><dt>Location</dt><dd>{open.location ?? '—'}</dd></div>
          <div><dt>Their notes</dt><dd>{open.notes ?? '—'}</dd></div>
          <div><dt>Estimate shown</dt><dd>{open.estimate_low ? `₹${open.estimate_low.toLocaleString('en-IN')} – ₹${open.estimate_high?.toLocaleString('en-IN')}` : '—'}</dd></div>
          <div><dt>Contact</dt><dd>{open.phone} · {open.email ?? '—'} · prefers {open.contact_pref ?? '—'}</dd></div>
          <div><dt>Received</dt><dd>{new Date(open.created_at).toLocaleString('en-IN')}{open.source?.in_app ? ` · from ${open.source.in_app}` : ''}</dd></div>
        </dl>
      </div>

      <div class="detail__work">
        <label class="f"><span>Quoted amount (₹)</span><input type="number" bind:value={quoted} /></label>
        <label class="f"><span>Internal notes</span><textarea rows="3" bind:value={notes}></textarea></label>
      </div>

      <div class="modal__foot">
        <a class="btn btn--sm btn--go" href={waLink(open)} target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn--sm btn--ghost" href={`tel:${open.phone}`}>Call</a>
        {#if open.email}<a class="btn btn--sm btn--ghost" href={`mailto:${open.email}?subject=${encodeURIComponent(`Your enquiry ${open.ref}`)}`}>Email</a>{/if}
        <span class="spacer"></span>
        {#if isAdmin()}<button class="btn btn--sm btn--del" onclick={() => remove(open!)}>Delete</button>{/if}
        <button class="btn btn--sm" onclick={saveDetail}>Save</button>
      </div>
    </div>
  </div>
{/if}
