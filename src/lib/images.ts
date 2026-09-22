import type { ImageMetadata } from 'astro';

// Content images are "asset:<file>" (bundled with the site) or a full URL
// (uploaded to the site-media bucket from the admin panel).
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/img/*.{jpg,jpeg,png,webp}', { eager: true });

export function resolveImage(ref: string): ImageMetadata | string | null {
  if (!ref) return null;
  if (ref.startsWith('asset:')) return files[`/src/assets/img/${ref.slice(6)}`]?.default ?? null;
  return ref;
}

export const url = (path = '') => import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
