/* =========================================================
   Motion core: shared GSAP setup, smooth scroll, page registry
   ========================================================= */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

// Instagram / in-app browsers resize the viewport as the URL bar hides.
// Recalculating every trigger on that is what causes jumps on phones.
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.ticker.lagSmoothing(0);

export { gsap, ScrollTrigger, SplitText, Flip };

// ?motion=on forces full motion for this tab (for previewing on machines
// with "reduce motion" switched on); ?motion=off does the opposite.
const force = (() => {
  const q = new URLSearchParams(location.search).get('motion');
  try {
    if (q) sessionStorage.setItem('myn-motion', q);
    return q || sessionStorage.getItem('myn-motion');
  } catch { return q; }
})();
export const REDUCED = force === 'on' ? false : force === 'off' ? true : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduced', REDUCED);
// Smooth scroll, cursor and hover tilt only for mouse/trackpad users.
// Touch devices keep native scrolling, which in-app browsers handle best.
export const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const MOBILE = () => window.matchMedia('(max-width: 900px)').matches;

export const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = document) => c.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = document) => Array.from(c.querySelectorAll<T>(s));

/* ---------- smooth scroll ---------- */
export let lenis: Lenis | null = null;
if (!REDUCED && FINE) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
}

export function scrollToTarget(target: string | HTMLElement) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.3 });
  else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
}

export const lockScroll = (on: boolean) => {
  if (lenis) on ? lenis.stop() : lenis.start();
  document.documentElement.style.overflow = on ? 'hidden' : '';
};

/* ---------- page registry ----------
   Page scripts register hooks; main.ts runs them in order once fonts and
   images are ready:  setup() → (loader) → intro() → ambient()          */
export interface PageHooks {
  setup?: () => void;
  intro?: () => gsap.core.Timeline | null | void;
  ambient?: () => void;
}
export const pages: PageHooks[] = [];
export const registerPage = (h: PageHooks) => { pages.push(h); };

/* ---------- helpers ---------- */
export const inr = (n: number) => n.toLocaleString('en-IN');
