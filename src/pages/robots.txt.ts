import type { APIRoute } from 'astro';

// Generated so the sitemap line always matches whatever domain the site is
// built for, instead of a hard-coded one.
export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${new URL('sitemap-index.xml', site)}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
