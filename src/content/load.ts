// Build-time content loader (runs in Astro frontmatter only, never in the browser).
//
// CONTENT_SOURCE (env):
//   "published" (default)  published documents from Supabase
//   "draft"                drafts, for preview builds; needs SUPABASE_SECRET_KEY
//   "defaults"             src/content/defaults.ts only (offline development)
//
// If Supabase can't be reached the build FAILS on purpose. The host then
// keeps serving the last good deploy instead of silently reverting content.
import { defaults, type Content, type DocKey } from './defaults';
import { backend } from '../data/backend';

let cache: Promise<Content> | null = null;

export function loadContent(): Promise<Content> {
  return (cache ??= fetchContent());
}

async function fetchContent(): Promise<Content> {
  const mode = process.env.CONTENT_SOURCE || 'published';
  if (mode === 'defaults') return structuredClone(defaults);

  const draft = mode === 'draft';
  const key = draft ? process.env.SUPABASE_SECRET_KEY : backend.key;
  if (!key) throw new Error('[content] CONTENT_SOURCE=draft needs SUPABASE_SECRET_KEY');

  const url = draft
    ? `${backend.url}/rest/v1/site_content?select=key,doc:draft`
    : `${backend.url}/rest/v1/published_content?select=key,doc`;
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`[content] Supabase returned ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { key: DocKey; doc: unknown }[];

  const out = structuredClone(defaults) as Record<string, unknown>;
  for (const { key: k, doc } of rows) {
    if (k in out && doc != null) out[k] = merge(out[k], doc);
  }
  return out as Content;
}

// Objects merge key by key (so fields added to defaults later still appear);
// arrays and scalars from the database win outright.
function merge(base: unknown, over: unknown): unknown {
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over;
  const o: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) o[k] = k in o ? merge(o[k], v) : v;
  return o;
}
