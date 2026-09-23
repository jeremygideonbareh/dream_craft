import type { APIRoute } from 'astro';

// Generated so the sitemap line always matches whatever domain and sub-path
// the site is built for, instead of a hard-coded one.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return new Response(
    `User-agent: *
Allow: /
Disallow: ${base}admin

Sitemap: ${new URL(`${base}sitemap-index.xml`, site)}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
};
