// Approximate-estimate maths. Pure functions over the pricing document, so the
// same code runs at build, in the quote wizard and in the admin preview.
import type { Content } from '../content/defaults';

export type Pricing = Pick<Content['pricing'], 'packages' | 'rules'>;

export interface EstimateInput {
  tier: string;           // package id | custom | unsure
  qty: number;
  finishes: string[];
  eventDate?: string;     // yyyy-mm-dd
}
export interface Estimate { low: number; high: number; lines: string[]; rush: boolean }

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function isRush(rushWithinDays: number, eventDate?: string, now = new Date()) {
  if (!eventDate) return false;
  const days = (new Date(eventDate).getTime() - now.getTime()) / 864e5;
  return days >= 0 && days < rushWithinDays;
}

const round = (n: number) => Math.round(n / 500) * 500;

export function estimateInvitations(p: Pricing, i: EstimateInput): Estimate | null {
  const r = p.rules;
  const qty = Math.max(0, Math.floor(i.qty || 0));
  if (!qty) return null;
  const lines: string[] = [];
  const pkg = p.packages.find((k) => k.id === i.tier);

  let base: number;
  if (pkg) {
    base = Math.max(pkg.from, (pkg.from / pkg.qty) * qty);
    lines.push(`${pkg.name} package, ${qty} invites`);
  } else {
    base = r.customFromPerInvite * qty;
    lines.push(`Custom invites from ${inr(r.customFromPerInvite)} each × ${qty}`);
    if (qty > r.bulkDiscountAbove) {
      base *= 1 - r.bulkDiscountPercent / 100;
      lines.push(`${r.bulkDiscountPercent}% off for ${r.bulkDiscountAbove}+ invites`);
    }
  }

  let extras = 0;
  if (i.finishes.includes('foil-names')) { extras += r.foilNamesPerInvite * qty; lines.push(`Name foiling +${inr(r.foilNamesPerInvite)} each`); }
  if (i.finishes.includes('foil-full')) { extras += r.foilFullPerInvite * qty; lines.push(`Full-page foiling +${inr(r.foilFullPerInvite)} each`); }
  const rush = isRush(r.rushWithinDays, i.eventDate);
  if (rush) { extras += r.rushPerInvite * qty; lines.push(`Rush order +${inr(r.rushPerInvite)} each`); }

  const low = round(base + extras);
  return { low, high: round(low * (1 + r.rangeSpreadPercent / 100)), lines, rush };
}
