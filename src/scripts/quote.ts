/* =========================================================
   Get a Quote wizard
   - one step per screen, answers saved to this device as you go
   - reference images compress on the phone, then upload straight away
   - live price range for invitations
   - submits one complete enquiry to Supabase, then offers WhatsApp
   ========================================================= */
import { createClient } from '@supabase/supabase-js';
import { gsap, REDUCED, $, $$, scrollToTarget } from './motion/core';
import { estimateInvitations, isRush, inr, type Pricing } from '../lib/pricing';
import { whatsappLink } from '../lib/site';
import { backend } from '../data/backend';
import type { Content, ProductDoc, Choice } from '../content/defaults';

// everything editable comes from the page, which got it from the admin panel
const data = JSON.parse($('#qzData')!.textContent || '{}') as {
  products: ProductDoc[];
  pricing: Pricing;
  copy: Content['quote'];
  brand: string;
  contact: Content['settings']['contact'];
  thumbs: Record<string, { src: string; product: string }>;
};
const productById: Record<string, ProductDoc> = Object.fromEntries(data.products.map((p) => [p.id, p]));
const sb = createClient(backend.url, backend.key, { auth: { persistSession: false } });

const form = $<HTMLFormElement>('#qz')!;
const stepsEls = $$<HTMLFieldSetElement>('.qz__step', form);
const LAST = stepsEls.length - 1;
const DRAFT = 'myn-quote-draft-v1';

/* ---------- state ---------- */
interface Upload { id: string; name: string; path?: string; preview: string; status: 'uploading' | 'done' | 'error'; gallery?: boolean }
interface Draft { step: number; values: Record<string, string | string[]>; uploads: Upload[]; session: string; ts: number }

let step = 0;
let uploads: Upload[] = [];
let session = crypto.randomUUID();
let submitting = false;
let sent = false; // once sent, never re-save or restore this enquiry

const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null);
const checked = (name: string) => $$<HTMLInputElement>(`[name="${name}"]:checked`, form).map((i) => i.value);
const one = (name: string) => checked(name)[0] || '';
const product = (): ProductDoc | undefined => productById[one('product')];

/* ---------- details step, built for the chosen product ---------- */
function group(label: string, name: string, choices: Choice[], multi = false, hint = '') {
  const type = multi ? 'checkbox' : 'radio';
  return `<div class="grp"><p class="grp__label">${label}${hint ? ` <small>${hint}</small>` : ''}</p><div class="chips">${choices
    .map((c) => `<label class="ch"><input type="${type}" name="${name}" value="${c.value}"><span>${c.label}${c.note ? ` <em>${c.note}</em>` : ''}</span></label>`)
    .join('')}</div><p class="qz__err" data-err="${name}"></p></div>`;
}

let builtFor = '';
function buildDetails() {
  const p = product();
  if (!p || builtFor === p.id) return;
  builtFor = p.id;
  let html = '';
  if (p.estimate) {
    html += group('Package', 'tier', [
      ...data.pricing.packages.map((k) => ({ value: k.id, label: k.name, note: `from ${inr(k.from)} / ${k.qty}` })),
      { value: 'custom', label: 'Fully custom', note: `from ${inr(data.pricing.rules.customFromPerInvite)} each` },
      { value: 'unsure', label: 'Help me choose', note: '' },
    ]);
  }
  if (p.variants.length) html += group('Type', 'variant', p.variants);
  if (p.sizes.length) html += group('Size', 'size', p.sizes);
  html += `<label class="fld" id="customSize" hidden><span>Custom size</span><input name="sizeCustom" maxlength="80" placeholder="e.g. 6 × 8 in" /></label>`;
  if (p.shapes.length) html += group('Shape', 'shape', p.shapes);
  if (p.materials.length) html += group(p.estimate ? 'Paper / material' : 'Material', 'material', p.materials);
  if (p.finishes.length) html += group('Finishing', 'finishes', p.finishes, true, '(pick any)');
  $('#details')!.innerHTML = html;
  $('#qtyUnit')!.textContent = p.unit;
  $('#qtyQuick')!.innerHTML = quickQty(p).map((n) => `<button type="button" class="ch ch--btn" data-set-qty="${n}"><span>${n}</span></button>`).join('');
  const q = val('quantity')!;
  if (!q.dataset.touched) q.value = String(p.defaultQty);
}
const quickQty = (p: ProductDoc) => (p.defaultQty >= 50 ? [50, 100, 150, 250, 500] : p.defaultQty >= 10 ? [10, 20, 50, 100] : [1, 2, 5, 10]);

/* ---------- uploads ---------- */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // e.g. HEIC on browsers that can't decode it: send as-is
  }
}

async function upload(u: Upload, file: File) {
  u.status = 'uploading';
  renderUploads();
  try {
    const blob = await compress(file);
    if (blob.size > backend.maxBytes) throw new Error('too big');
    const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'img').toLowerCase().slice(0, 5);
    const path = `incoming/${session}/${u.id}.${ext}`;
    const { error } = await sb.storage.from(backend.bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
    if (error) throw error;
    u.path = path;
    u.status = 'done';
  } catch (err) {
    console.warn('[quote] upload failed', err);
    u.status = 'error';
    (u as Upload & { file?: File }).file = file;
  }
  renderUploads();
  save();
}

function addFiles(files: FileList | File[]) {
  const room = backend.maxFiles - uploads.length;
  const all = Array.from(files);
  const list = all.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (list.length < all.length) flash('Only images can be added here.');
  if (list.length > room) flash(`You can add up to ${backend.maxFiles} images.`);
  list.slice(0, Math.max(0, room)).forEach((f) => {
    if (f.size > 25 * 1024 * 1024) { flash(`${f.name} is too large.`); return; }
    const u: Upload = { id: crypto.randomUUID(), name: f.name, preview: URL.createObjectURL(f), status: 'uploading' };
    uploads.push(u);
    upload(u, f);
  });
}

const popped = new Set<string>();
const BLANK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#F3DDCD"/></svg>');
function renderUploads() {
  const ul = $('#upList')!;
  ul.innerHTML = uploads
    .map((u) => `<li class="up__item is-${u.status}" data-id="${u.id}">
      <img src="${u.preview}" alt="" />
      ${u.status === 'uploading' ? '<span class="up__spin" aria-label="Uploading"></span>' : ''}
      ${u.status === 'error' ? `<button type="button" class="up__retry" data-retry="${u.id}">Retry</button>` : ''}
      ${u.gallery ? '<span class="up__tag">Our work</span>' : ''}
      ${u.preview === BLANK ? '<span class="up__saved">Uploaded ✓</span>' : ''}
      <button type="button" class="up__rm" data-rm="${u.id}" aria-label="Remove ${u.name.replace(/"/g, '')}">×</button>
    </li>`)
    .join('');
  const fresh = uploads.filter((u) => !popped.has(u.id));
  fresh.forEach((u) => popped.add(u.id));
  if (!REDUCED && fresh.length) gsap.from(fresh.map((u) => ul.querySelector(`[data-id="${u.id}"]`)), { scale: 0.6, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: 'back.out(2)' });
  $('.up__drop')!.classList.toggle('is-full', uploads.length >= backend.maxFiles);
}

/* ---------- estimate ---------- */
function updateEstimate() {
  const box = $('#est')!;
  const p = product();
  const rush = isRush(data.pricing.rules.rushWithinDays, val('eventDate')?.value);
  $('#rushNote')!.hidden = !rush;
  if (!p?.estimate || step < 2 || step === LAST + 1) { box.hidden = true; return null; }
  const est = estimateInvitations(data.pricing, {
    tier: one('tier') || 'custom',
    qty: +val('quantity')!.value,
    finishes: checked('finishes'),
    eventDate: val('eventDate')?.value,
  });
  box.hidden = !est;
  if (!est) return null;
  tweenNum($('#estLow')!, est.low);
  tweenNum($('#estHigh')!, est.high);
  $('#estLines')!.innerHTML = est.lines.map((l) => `<li>${l}</li>`).join('');
  return est;
}
function tweenNum(el: HTMLElement, to: number) {
  const from = +(el.dataset.v || 0);
  el.dataset.v = String(to);
  if (REDUCED) { el.textContent = inr(to); return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: 0.7, ease: 'power3.out', overwrite: true, onUpdate: () => (el.textContent = inr(Math.round(o.v / 100) * 100)) });
}

/* ---------- validation ---------- */
const phoneOk = (s: string) => s.replace(/\D/g, '').length >= 10 && s.replace(/\D/g, '').length <= 15;
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

function validate(i: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (i === 0 && !one('product')) e.product = 'Choose what you would like made.';
  if (i === 2 && product()?.sizes && one('size') === 'custom' && !val('sizeCustom')?.value.trim()) e.size = 'Tell us the custom size you have in mind.';
  if (i === 3) {
    const q = +val('quantity')!.value;
    if (!(q >= 1 && q <= 100000)) e.quantity = 'Enter a quantity (at least 1).';
    if (!one('budget')) e.budget = 'Pick a budget range, or "Not sure yet".';
  }
  if (i === 4) {
    const d = val('eventDate')!.value;
    const flexible = val('dateFlexible')!.checked;
    if (!d && !flexible) e.eventDate = 'Add your date, or tick "My date isn\'t fixed yet".';
    if (d && new Date(d) < new Date(new Date().toDateString())) e.eventDate = 'That date has already passed.';
    if (!val('location')!.value.trim()) e.location = 'Where is the celebration?';
  }
  if (i === 5) {
    if (val('name')!.value.trim().length < 2) e.name = 'Please enter your name.';
    if (!phoneOk(val('phone')!.value)) e.phone = 'Enter a phone number with country code, e.g. +91 98765 43210.';
    if (!val('waSame')!.checked && !phoneOk(val('whatsapp')!.value)) e.whatsapp = 'Enter your WhatsApp number.';
    if (!emailOk(val('email')!.value.trim())) e.email = 'Enter a valid email so we can send your copy.';
    if (!val('consent')!.checked) e.consent = 'Please tick the box so we can store your enquiry.';
  }
  return e;
}

function showErrors(errs: Record<string, string>) {
  $$('[data-err]', form).forEach((p) => (p.textContent = errs[p.dataset.err!] || ''));
  $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
  const keys = Object.keys(errs);
  keys.forEach((k) => $$(`[name="${k}"]`, form).forEach((el) => el.closest('.fld, .grp, .qz__products, .tick')?.classList.add('is-invalid')));
  if (keys.length) {
    const first = $(`[data-err="${keys[0]}"]`, form)!;
    if (!REDUCED) gsap.fromTo(stepsEls[step], { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    first.closest('.fld, .grp, fieldset')?.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
    ($(`[name="${keys[0]}"]`, form) as HTMLElement | null)?.focus({ preventScroll: true });
  }
}

/* ---------- navigation ---------- */
function go(to: number, focus = true) {
  const from = step;
  step = Math.max(0, Math.min(LAST, to));
  if (step >= 2) buildDetails();
  if (step === LAST) renderReview();

  const out = stepsEls[from], inn = stepsEls[step];
  const dir = step >= from ? 1 : -1;
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    stepsEls.forEach((s, i) => (s.hidden = i !== step));
    if (!REDUCED && from !== step) {
      gsap.fromTo(inn, { x: 60 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out' });
      gsap.from(inn.querySelectorAll('.qp, .grp, .fld, .tick, .up, .rev > div'), { y: 24, autoAlpha: 0, duration: 0.5, stagger: 0.035, ease: 'power3.out', delay: 0.08 });
    }
    if (focus) {
      scrollToTarget('#quote');
      inn.querySelector<HTMLElement>('.qz__title')?.focus({ preventScroll: true });
    }
  };
  if (!REDUCED && from !== step && !out.hidden) {
    gsap.to(out, { x: -40 * dir, autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: show });
    // moving on must never wait on an animation: if frames stall (a
    // throttled phone, a backgrounded tab), a timer swaps the step anyway
    setTimeout(show, 400);
  } else show();

  $('#qzBack')!.hidden = step === 0;
  const next = $('#qzNext')!;
  next.querySelector('span')!.textContent = step === LAST ? 'Send enquiry' : step === 1 && !uploads.length ? 'Skip for now' : 'Continue';
  $$('[data-dot]').forEach((d, i) => { d.classList.toggle('is-done', i < step); d.classList.toggle('is-on', i === step); });
  gsap.to('#qzBar', { scaleX: step / LAST, duration: REDUCED ? 0 : 0.6, ease: 'power3.out' });
  updateEstimate();
  save();
}

function next() {
  if (step === LAST) return submit();
  if (step === 1 && uploads.some((u) => u.status === 'uploading')) { flash('Hold on, your images are still uploading…'); return; }
  const errs = validate(step);
  showErrors(errs);
  if (Object.keys(errs).length) return;
  go(step + 1);
}

/* ---------- review ---------- */
const labelOf = (name: string, v: string) => $(`[name="${name}"][value="${CSS.escape(v)}"]`, form)?.closest('label')?.querySelector('span')?.childNodes[0]?.textContent?.trim() || v;
function renderReview() {
  const p = product()!;
  const d = val('eventDate')!.value;
  const rows: [string, string, number][] = [
    ['Making', [p.title, one('variant') && labelOf('variant', one('variant'))].filter(Boolean).join(' · '), 0],
    ['Inspiration', uploads.length ? `${uploads.filter((u) => u.status === 'done').length} image(s) attached` : 'None added', 1],
    ['Details', [
      one('tier') && labelOf('tier', one('tier')),
      one('size') && (one('size') === 'custom' ? val('sizeCustom')?.value : labelOf('size', one('size'))),
      one('shape') && labelOf('shape', one('shape')),
      one('material') && labelOf('material', one('material')),
      ...checked('finishes').map((f) => labelOf('finishes', f)),
      ...checked('colours'),
      val('colourNotes')?.value,
    ].filter(Boolean).join(' · ') || 'To discuss', 2],
    ['Quantity & budget', `${val('quantity')!.value} ${p.unit} · ${one('budget')}`, 3],
    ['Date & place', `${one('occasion')} · ${d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date not fixed yet'} · ${val('location')!.value}`, 4],
    ['Contact', `${val('name')!.value} · ${val('phone')!.value} · ${val('email')!.value}`, 5],
  ];
  $('#review')!.innerHTML = rows
    .map(([k, v, s]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd><button type="button" class="rev__edit" data-goto="${s}">Edit</button></div>`)
    .join('');
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ---------- submit ---------- */
async function submit() {
  if (submitting) return;
  for (let i = 0; i < LAST; i++) {
    const errs = validate(i);
    if (Object.keys(errs).length) { go(i); setTimeout(() => showErrors(errs), 400); return; }
  }
  if (uploads.some((u) => u.status === 'uploading')) { flash('Your images are still uploading, one moment…'); return; }

  submitting = true;
  const btn = $<HTMLButtonElement>('#qzNext')!;
  btn.disabled = true;
  btn.querySelector('span')!.textContent = 'Sending…';
  showErrors({});

  const p = product()!;
  const est = p.estimate ? updateEstimate() : null;
  const payload = {
    website: val('website')!.value,
    product: p.id,
    variant: one('variant'),
    tier: one('tier'),
    size: one('size'),
    size_custom: val('sizeCustom')?.value || '',
    shape: one('shape'),
    material: one('material'),
    finishes: checked('finishes'),
    colours: checked('colours'),
    colour_notes: val('colourNotes')!.value,
    notes: (val('notes') as unknown as HTMLTextAreaElement).value,
    quantity: +val('quantity')!.value,
    budget: one('budget'),
    occasion: one('occasion'),
    event_date: val('eventDate')!.value || null,
    date_flexible: val('dateFlexible')!.checked,
    location: val('location')!.value,
    name: val('name')!.value.trim(),
    phone: val('phone')!.value.trim(),
    whatsapp: val('waSame')!.checked ? val('phone')!.value.trim() : val('whatsapp')!.value.trim(),
    email: val('email')!.value.trim(),
    contact_pref: one('contactPref'),
    consent: val('consent')!.checked,
    reference_paths: uploads.filter((u) => u.path && !u.gallery).map((u) => u.path),
    gallery_refs: uploads.filter((u) => u.gallery).map((u) => u.name),
    estimate_low: est?.low ?? null,
    estimate_high: est?.high ?? null,
    estimate_lines: est?.lines ?? [],
    rush: isRush(data.pricing.rules.rushWithinDays, val('eventDate')!.value),
    source: sourceInfo(),
  };

  const { data: ref, error } = await sb.rpc('submit_enquiry', { payload });
  submitting = false;
  btn.disabled = false;
  if (error || !ref) {
    console.error('[quote] submit failed', error);
    btn.querySelector('span')!.textContent = 'Try again';
    const msg = error?.message?.includes('rate') ? 'We already have several enquiries from this number today. Message us on WhatsApp instead.' : 'Sorry, that didn\'t go through. Check your connection and try again. Your answers are saved.';
    showErrors({ submit: msg });
    return;
  }
  success(String(ref), payload.name, p.title);
}

function success(ref: string, name: string, title: string) {
  sent = true;
  try { localStorage.removeItem(DRAFT); } catch {}
  $('#doneRef')!.textContent = ref;
  $('#doneName')!.textContent = name.split(' ')[0];
  const d = val('eventDate')!.value;
  const msg = `Hi ${data.brand}! I just sent enquiry ${ref} on your website for ${title.toLowerCase()} (${val('quantity')!.value}${d ? `, ${d}` : ''}, ${val('location')!.value}).`;
  $<HTMLAnchorElement>('#doneWa')!.href = whatsappLink(data.contact, msg);
  const done = $('#done')!;
  form.hidden = true;
  $('.qz__progress')!.setAttribute('hidden', '');
  done.hidden = false;
  done.focus({ preventScroll: true });
  scrollToTarget('#quote');
  if (!REDUCED) {
    const tick = $$<SVGPathElement | SVGCircleElement>('.done__tick circle, .done__tick path');
    tick.forEach((p) => { const l = (p as SVGGeometryElement).getTotalLength(); gsap.set(p, { strokeDasharray: l, strokeDashoffset: l }); });
    gsap.timeline()
      .to(tick, { strokeDashoffset: 0, duration: 0.8, stagger: 0.3, ease: 'power2.inOut' })
      .from(done.querySelectorAll(':scope > *:not(.done__tick)'), { y: 30, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, 0.3);
    petals(done);
  }
}

function petals(host: HTMLElement) {
  const colours = ['#B85C38', '#EBC9B2', '#8A9A74', '#C9A45C'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i');
    p.className = 'petal';
    p.style.background = colours[i % colours.length];
    host.appendChild(p);
    gsap.fromTo(p, { x: 0, y: 0, rotate: 0, scale: gsap.utils.random(0.6, 1.3), autoAlpha: 1 }, {
      x: gsap.utils.random(-260, 260), y: gsap.utils.random(-220, 60), rotate: gsap.utils.random(-400, 400),
      duration: gsap.utils.random(1.2, 2), ease: 'power3.out',
      onComplete: () => { gsap.to(p, { y: '+=120', autoAlpha: 0, duration: 1.2, ease: 'power1.in', onComplete: () => p.remove() }); },
    });
  }
}

function sourceInfo() {
  const q = new URLSearchParams(location.search);
  const ua = navigator.userAgent;
  return {
    utm_source: q.get('utm_source') || '', utm_campaign: q.get('utm_campaign') || '',
    referrer: document.referrer.slice(0, 200),
    in_app: /Instagram|FBAN|FBAV/i.test(ua) ? 'instagram/facebook' : '',
  };
}

/* ---------- draft ---------- */
function save() {
  if (sent) return;
  const values: Draft['values'] = {};
  new FormData(form).forEach((v, k) => {
    if (k === 'website' || typeof v !== 'string') return;
    const prev = values[k];
    values[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  $$<HTMLInputElement>('input[type=checkbox]', form).forEach((c) => { if (!c.checked && !(c.name in values)) values[c.name] = []; });
  const d: Draft = { step, values, session, ts: Date.now(), uploads: uploads.filter((u) => u.path || u.gallery).map(({ id, name, path, gallery }) => ({ id, name, path, gallery, status: 'done', preview: '' })) };
  try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch {}
}

function apply(values: Draft['values']) {
  // product first so the details step exists before we fill it
  if (values.product) setField('product', values.product);
  buildDetails();
  Object.entries(values).forEach(([k, v]) => k !== 'product' && setField(k, v));
}
function setField(name: string, v: string | string[]) {
  const els = $$<HTMLInputElement>(`[name="${name}"]`, form);
  const vs = Array.isArray(v) ? v : [v];
  els.forEach((el) => {
    if (el.type === 'radio' || el.type === 'checkbox') el.checked = el.type === 'checkbox' && el.value === 'on' ? vs.includes('on') : vs.includes(el.value);
    else el.value = vs[0] ?? '';
  });
}

function restore(): boolean {
  let d: Draft | null = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch {}
  if (!d || Date.now() - d.ts > 30 * 864e5) return false;
  session = d.session;
  // uploaded files are private, so after a reload they show as a plain tile
  uploads = d.uploads.map((u) => ({ ...u, preview: u.gallery ? data.thumbs[u.name]?.src ?? BLANK : BLANK }));
  apply(d.values);
  renderUploads();
  go(d.step, false);
  return true;
}

/* ---------- misc ---------- */
function flash(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  gsap.fromTo(t, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)' });
  gsap.to(t, { y: 40, autoAlpha: 0, delay: 3, duration: 0.3, onComplete: () => t.remove() });
}

/* ---------- wire up ---------- */
function init() {
  const q = new URLSearchParams(location.search);
  const restored = restore();

  // deep links: ?product=bouquets&tier=signature&ref=bouquet-tulip.jpg
  const pre = q.get('product');
  if (pre && productById[pre]) {
    setField('product', pre);
    builtFor = '';
    buildDetails();
    const tier = q.get('tier');
    if (tier) setField('tier', tier);
    const ref = q.get('ref');
    if (ref && data.thumbs[ref] && !uploads.some((u) => u.name === ref)) {
      uploads.push({ id: crypto.randomUUID(), name: ref, preview: data.thumbs[ref].src, status: 'done', gallery: true });
      renderUploads();
    }
    go(1, false); // a product link always starts at the inspiration step
  } else {
    go(restored ? step : 0, false);
  }

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'product') { builtFor = ''; buildDetails(); setTimeout(next, REDUCED ? 0 : 250); }
    if (t.name === 'size') $('#customSize')!.hidden = t.value !== 'custom';
    if (t.name === 'waSame') $('#waField')!.hidden = t.checked;
    if (t.name === 'dateFlexible' && t.checked) showErrors({});
    updateEstimate();
    save();
  });
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'quantity') t.dataset.touched = '1';
    updateEstimate();
    save();
  });
  form.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-qty], [data-set-qty], [data-rm], [data-retry], [data-goto]');
    if (!t) return;
    const qty = val('quantity')!;
    if (t.dataset.qty) { qty.value = String(Math.max(1, (+qty.value || 0) + +t.dataset.qty * (+qty.value >= 50 ? 10 : 1))); qty.dataset.touched = '1'; }
    if (t.dataset.setQty) { qty.value = t.dataset.setQty; qty.dataset.touched = '1'; }
    if (t.dataset.rm) { uploads = uploads.filter((u) => u.id !== t.dataset.rm); renderUploads(); }
    if (t.dataset.retry) {
      const u = uploads.find((x) => x.id === t.dataset.retry) as (Upload & { file?: File }) | undefined;
      if (u?.file) upload(u, u.file);
    }
    if (t.dataset.goto) go(+t.dataset.goto);
    if (!REDUCED && (t.dataset.qty || t.dataset.setQty)) gsap.fromTo(qty, { scale: 1.12 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    updateEstimate();
    save();
    if (step === 1) go(1, false);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); next(); });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); next(); }
  });
  $('#qzNext')!.addEventListener('click', next);
  $('#qzBack')!.addEventListener('click', () => { showErrors({}); go(step - 1); });

  const input = $<HTMLInputElement>('#upInput')!;
  input.addEventListener('change', () => { if (input.files) addFiles(input.files); input.value = ''; go(1, false); });
  const zone = $('#upZone')!;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); go(1, false); });

  // no dates in the past
  $<HTMLInputElement>('#eventDate')!.min = new Date().toISOString().slice(0, 10);

  $('#doneAgain')!.addEventListener('click', (e) => { e.preventDefault(); try { localStorage.removeItem(DRAFT); } catch {} location.href = location.pathname; });
  window.addEventListener('beforeunload', save);
}

init();
