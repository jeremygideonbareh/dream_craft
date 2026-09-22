/* =========================================================
   Admin panel data layer: session, role, content documents, media.
   Every rule here is also enforced by the database.
   ========================================================= */
import { createClient, type Session } from '@supabase/supabase-js';
import { backend } from '../data/backend';
import { defaults, STAFF_DOCS, type DocKey } from '../content/defaults';

export const sb = createClient(backend.url, backend.key);
export { defaults, STAFF_DOCS };
export type Role = 'admin' | 'staff';

export interface Member { user_id: string; email: string; name: string | null; role: Role; active: boolean }
export interface Doc { key: DocKey; draft: any; published: any; draft_updated_at: string; published_at: string | null; saved?: string }

export const app = $state({
  session: null as Session | null,
  me: null as Member | null,
  docs: {} as Record<string, Doc>,
  loading: true,
  checking: false,   // looking up this login's role
  error: '',
  toast: '',
});

export const isAdmin = () => app.me?.role === 'admin';
export const canEdit = (key: string) => isAdmin() || STAFF_DOCS.includes(key as DocKey);

export function toast(msg: string) {
  app.toast = msg;
  setTimeout(() => { if (app.toast === msg) app.toast = ''; }, 3500);
}

/* ---------- session ---------- */
export async function initSession() {
  const { data } = await sb.auth.getSession();
  await setSession(data.session);
  sb.auth.onAuthStateChange((_e, s) => { setSession(s); });
  app.loading = false;
}

async function setSession(s: Session | null) {
  app.session = s;
  if (!s) { app.me = null; return; }
  // keep the old value while we look up the role, so the panel never flashes
  // "No access" at someone who does have access
  app.checking = true;
  const { data } = await sb.from('staff_members').select('*').eq('user_id', s.user.id).maybeSingle();
  app.me = (data as Member) || null;
  app.checking = false;
  if (app.me?.active) await loadDocs();
}

export const signIn = (email: string, password: string) => sb.auth.signInWithPassword({ email, password });
export const signUp = (email: string, password: string) =>
  sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href } });
export const resetPassword = (email: string) => sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
export const signOut = () => sb.auth.signOut();

/* ---------- content ---------- */
export async function loadDocs() {
  const { data, error } = await sb.from('site_content').select('*');
  if (error) { app.error = error.message; return; }
  const next: Record<string, Doc> = {};
  for (const row of data as Doc[]) {
    // Postgres returns JSON keys in its own order; show them in the order the
    // site defines them, so the hero comes before the footer.
    const tpl = defaults[row.key as DocKey];
    const draft = ordered(tpl, row.draft);
    next[row.key] = { ...row, draft, published: ordered(tpl, row.published), saved: JSON.stringify(draft) };
  }
  // fill in any document the code knows about but the database doesn't yet
  for (const key of Object.keys(defaults) as DocKey[]) {
    next[key] ??= { key, draft: structuredClone(defaults[key]), published: {}, draft_updated_at: '', published_at: null };
  }
  app.docs = next;
}

// rebuild `val` with the key order of `tpl`, keeping anything extra at the end
function ordered(tpl: unknown, val: unknown): unknown {
  if (Array.isArray(val)) return val.map((v) => ordered(Array.isArray(tpl) ? tpl[0] : undefined, v));
  if (!val || typeof val !== 'object' || !tpl || typeof tpl !== 'object' || Array.isArray(tpl)) return val;
  const v = val as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(tpl as Record<string, unknown>)) if (k in v) out[k] = ordered((tpl as Record<string, unknown>)[k], v[k]);
  for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k];
  return out;
}

// edits that exist only in this browser and would be lost on a refresh
export const unsaved = () =>
  (Object.keys(app.docs) as DocKey[]).filter((k) => app.docs[k].saved !== undefined && JSON.stringify(app.docs[k].draft) !== app.docs[k].saved);

export const unpublished = () =>
  (Object.keys(app.docs) as DocKey[]).filter(
    (k) => canEdit(k) && JSON.stringify(app.docs[k].draft) !== JSON.stringify(app.docs[k].published)
  );

// A product's id appears in quote links, so give new items a readable one
// based on their title, and never allow two the same.
function tidyIds(doc: unknown) {
  if (!Array.isArray(doc)) return doc;
  const seen = new Set<string>();
  for (const item of doc as Record<string, string>[]) {
    if (!item || typeof item !== 'object' || !('id' in item)) continue;
    const auto = /^[0-9a-f]{8}$/.test(item.id || '');
    let id = auto || !item.id
      ? String(item.title || item.id || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'
      : item.id;
    let n = 2;
    while (seen.has(id)) id = `${id}-${n++}`;
    seen.add(id);
    item.id = id;
  }
  return doc;
}

// Optimistic concurrency: refuse to overwrite a draft someone else changed.
export async function saveDoc(key: DocKey) {
  const doc = app.docs[key];
  if (!doc) return false;
  if (key === 'products' || key === 'gallery') tidyIds(doc.draft);
  const { data, error } = await sb
    .from('site_content')
    .update({ draft: doc.draft, draft_updated_at: new Date().toISOString(), draft_updated_by: app.session?.user.id })
    .eq('key', key)
    .eq('draft_updated_at', doc.draft_updated_at)
    .select('draft_updated_at')
    .maybeSingle();
  if (error) { toast(error.message); return false; }
  if (!data) {
    toast('Someone else edited this page. Reload before saving.');
    return false;
  }
  doc.draft_updated_at = data.draft_updated_at;
  doc.saved = JSON.stringify(doc.draft);
  return true;
}

export async function publish(keys: DocKey[]) {
  const allowed = keys.filter(canEdit);
  if (!allowed.length) return false;
  const { error } = await sb.rpc('publish_content', { keys: allowed, note: null });
  if (error) { toast(error.message); return false; }
  await loadDocs();
  toast(allowed.length === 1 ? 'Published. The site rebuilds in a minute.' : `Published ${allowed.length} sections.`);
  return true;
}

export async function versions(key: DocKey) {
  const { data } = await sb.from('content_versions').select('id, key, saved_at, note').eq('key', key).order('id', { ascending: false }).limit(20);
  return data || [];
}
export async function restore(id: number) {
  const { error } = await sb.rpc('restore_version', { version_id: id });
  if (error) { toast(error.message); return false; }
  await loadDocs();
  toast('Restored into the draft. Publish it when you are happy.');
  return true;
}

/* ---------- media ---------- */
export async function uploadMedia(file: File): Promise<string | null> {
  const blob = await compress(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const path = `uploads/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('site-media').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) { toast(error.message); return null; }
  return sb.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

export async function listMedia(): Promise<string[]> {
  const out: string[] = [];
  for (const year of ['2026', '2027', String(new Date().getFullYear())].filter((v, i, a) => a.indexOf(v) === i)) {
    const { data } = await sb.storage.from('site-media').list(`uploads/${year}`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    for (const f of data || []) out.push(sb.storage.from('site-media').getPublicUrl(`uploads/${year}/${f.name}`).data.publicUrl);
  }
  return out;
}

// Resize on the device so a 6 MB phone photo doesn't become a 6 MB page image.
export async function compress(file: File, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 600_000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/* ---------- enquiries ---------- */
export interface Enquiry {
  id: string; ref: string; created_at: string; status: string; product: string; variant: string | null; tier: string | null;
  size: string | null; size_custom: string | null; shape: string | null; material: string | null;
  finishes: string[]; colours: string[]; colour_notes: string | null; notes: string | null;
  quantity: number; budget: string | null; occasion: string | null; event_date: string | null;
  date_flexible: boolean; location: string | null; rush: boolean;
  name: string; phone: string; whatsapp: string | null; email: string | null; contact_pref: string | null;
  reference_paths: string[]; gallery_refs: string[];
  estimate_low: number | null; estimate_high: number | null; estimate_lines: string[];
  quoted_amount: number | null; internal_notes: string | null; source: Record<string, string>;
}

export const STATUSES = ['new', 'reviewing', 'quoted', 'confirmed', 'in_production', 'dispatched', 'completed', 'lost', 'spam'] as const;

export async function listEnquiries(filter: { status?: string; product?: string; search?: string } = {}) {
  let q = sb.from('enquiries').select('*').order('created_at', { ascending: false }).limit(200);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.product) q = q.eq('product', filter.product);
  if (filter.search) q = q.or(`name.ilike.%${filter.search}%,ref.ilike.%${filter.search}%,phone.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
  const { data, error } = await q;
  if (error) { app.error = error.message; return []; }
  return (data || []) as Enquiry[];
}

export async function updateEnquiry(id: string, patch: Partial<Enquiry>) {
  const { error } = await sb.from('enquiries').update(patch).eq('id', id);
  if (error) { toast(error.message); return false; }
  return true;
}

export async function deleteEnquiry(id: string) {
  const { error } = await sb.from('enquiries').delete().eq('id', id);
  if (error) { toast(error.message); return false; }
  return true;
}

// Reference images are private: hand out short-lived links.
export async function signedRefs(paths: string[]) {
  if (!paths.length) return [];
  const { data } = await sb.storage.from('references').createSignedUrls(paths, 3600);
  return (data || []).map((d) => d.signedUrl).filter(Boolean);
}

/* ---------- team ---------- */
export async function listTeam() {
  const [{ data: members }, { data: invites }] = await Promise.all([
    sb.from('staff_members').select('*').order('created_at'),
    sb.from('staff_invites').select('*').order('created_at'),
  ]);
  return { members: (members || []) as Member[], invites: invites || [] };
}
export async function invite(email: string, role: Role, name: string) {
  const { error } = await sb.from('staff_invites').insert({ email: email.toLowerCase().trim(), role, name, invited_by: app.session?.user.id });
  if (error) { toast(error.message); return false; }
  toast('Invited. They sign up at /admin with this email.');
  return true;
}
export async function revokeInvite(email: string) {
  const { error } = await sb.from('staff_invites').delete().eq('email', email);
  if (error) { toast(error.message); return false; }
  return true;
}
export async function setMember(user_id: string, patch: Partial<Member>) {
  const { error } = await sb.from('staff_members').update(patch).eq('user_id', user_id);
  if (error) { toast(error.message); return false; }
  return true;
}

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtWhen = (s: string) => {
  const mins = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return fmtDate(s);
};
