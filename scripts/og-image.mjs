// Draws public/og.png, the picture shown when the site is shared on WhatsApp,
// Instagram or Facebook. Re-run after a brand change:  node scripts/og-image.mjs
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { defaults } from '../src/content/defaults.ts';

const { brand, contact } = defaults.settings;
const NAME = brand.display.toLowerCase();
const ACCENT = (brand.wordmarkAccentLetter || '').toLowerCase();
const TAGLINE = brand.tagline;
const PLACE = `${contact.location} · India`;

const xml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const at = ACCENT ? NAME.indexOf(ACCENT) : -1;
const wordmark = at < 0
  ? xml(NAME)
  : `${xml(NAME.slice(0, at))}<tspan fill="#B85C38">${xml(NAME[at])}</tspan>${xml(NAME.slice(at + 1))}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bloom" cx="78%" cy="18%" r="62%">
      <stop offset="0%" stop-color="#F3DDCD"/>
      <stop offset="55%" stop-color="#F5E9DA"/>
      <stop offset="100%" stop-color="#FBF5EC"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bloom)"/>
  <g fill="none" stroke="#B85C38" stroke-width="1.6" opacity=".45">
    <path d="M1010 92c26 30 26 90 0 120-26-30-26-90 0-120Z"/>
    <path d="M950 152c30-26 90-26 120 0-30 26-90 26-120 0Z"/>
    <circle cx="1010" cy="152" r="86"/>
  </g>
  <g fill="none" stroke="#7C8A6B" stroke-width="1.4" opacity=".4">
    <path d="M132 470c22 26 22 76 0 102-22-26-22-76 0-102Z"/>
    <path d="M81 521c26-22 76-22 102 0-26 22-76 22-102 0Z"/>
  </g>
  <text x="90" y="300" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="150" fill="#33241B">${
    ACCENT && NAME.includes(ACCENT)
      ? `${xml(NAME.slice(0, NAME.indexOf(ACCENT)))}<tspan fill="#B85C38">${ACCENT}</tspan>${xml(NAME.slice(NAME.indexOf(ACCENT) + 1))}`
      : xml(NAME)
  }</text>
  <text x="96" y="372" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#6B564A">${xml(TAGLINE)}</text>
  <text x="96" y="446" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="5" fill="#B85C38">${xml(PLACE).toUpperCase()}</text>
  <rect x="96" y="486" width="150" height="3" fill="#B85C38"/>
  <text x="96" y="560" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="3" fill="#6B564A">GET A QUOTE IN ABOUT TWO MINUTES</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log(`og.png written (${(png.length / 1024).toFixed(0)} kB) for ${NAME}`);
