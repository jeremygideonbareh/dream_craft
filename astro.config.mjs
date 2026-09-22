import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// SITE_URL / BASE_PATH let the same build run on the final custom domain
// (base "/") or a GitHub Pages project path (base "/dream_craft/").
export default defineConfig({
  site: process.env.SITE_URL || 'https://mynsera.in',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [svelte()],
  // images uploaded from the admin panel are optimised at build time
  image: { domains: ['ttgkrrqzmrlublrbhxex.supabase.co'] },
});
