/* =========================================================
   Site-wide motion + UI: loader, nav, drawer, quote bar, cursor,
   then boots whichever page hooks were registered.
   ========================================================= */
import { gsap, ScrollTrigger, REDUCED, FINE, $, $$, lenis, lockScroll, scrollToTarget, pages } from './core';
import { reveals, floats } from './reveals';

declare global { interface Window { __mynMotion?: boolean } }
window.__mynMotion = true;

const html = document.documentElement;

/* ---------- loader (first visit per session only) ---------- */
function runLoader(): Promise<void> {
  const loader = $('#loader');
  if (!loader || !html.classList.contains('has-loader')) return Promise.resolve();
  if (lenis) lenis.stop();
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      html.classList.remove('has-loader', 'is-loading');
      try { sessionStorage.setItem('myn-intro', '1'); } catch {}
      if (lenis) lenis.start();
      resolve();
    };
    // Kept short on purpose: visitors from Instagram leave if they wait.
    // Timer backup: animation frames pause in background tabs, a timer doesn't.
    setTimeout(() => { if (!finished) { tl.progress(1); done(); } }, 3000);
    const tl = gsap.timeline({ onComplete: done });
    tl
      .from('.loader__word span span', { yPercent: 120, duration: 0.8, stagger: 0.05, ease: 'power4.out' })
      .from('.loader__word .acc', { y: -60, rotate: -30, duration: 0.7, ease: 'bounce.out' }, 0.25)
      .to('.loader__bar i', { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 0.1)
      .from('.loader__meta', { autoAlpha: 0, y: 10, duration: 0.5 }, 0.3)
      .to('.loader__inner', { yPercent: -30, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, '+=0.1')
      .to('.loader__panels span', { yPercent: -101, duration: 0.9, stagger: 0.06, ease: 'expo.inOut' }, '-=0.3');
  });
}

/* ---------- chrome ---------- */
function chrome() {
  const nav = $('#nav')!;
  const qbar = $('#qbar');

  // progress bar
  gsap.to('#progressBar', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });

  // nav: shrink border once scrolled, slide away going down, back going up.
  // quote bar: appears once you're past the first screen.
  let lastDir = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle('is-stuck', y > 40);
      if (self.direction !== lastDir) {
        lastDir = self.direction;
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 400 && !nav.classList.contains('menu-open'));
      }
      if (y < 400) nav.classList.remove('is-hidden');
      if (qbar && !REDUCED) {
        const show = y > window.innerHeight * 0.6;
        if (show !== qbar.classList.contains('is-on')) {
          qbar.classList.toggle('is-on', show);
          gsap.to(qbar, { yPercent: show ? 0 : 160, duration: 0.6, ease: show ? 'back.out(1.6)' : 'power3.in', overwrite: true });
        }
      }
    },
  });
  if (qbar && REDUCED) gsap.set(qbar, { yPercent: 0 });

  // anchors (smooth, and close the drawer first)
  $$<HTMLAnchorElement>('a[href*="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const u = new URL(a.href);
      if (u.pathname !== location.pathname || !u.hash) return;
      const el = $(u.hash);
      if (!el) return;
      e.preventDefault();
      if (drawerOpen) toggleDrawer(false);
      scrollToTarget(el);
    });
  });

  // drawer
  const drawer = $('#drawer')!, burger = $('#burger')!;
  let drawerOpen = false;
  const dTl = gsap.timeline({ paused: true })
    .set(drawer, { visibility: 'visible' })
    .to(drawer, { clipPath: 'inset(0% 0% 0% 0%)', duration: REDUCED ? 0 : 0.8, ease: 'expo.inOut' })
    .from('.drawer__nav a', { yPercent: 110, autoAlpha: 0, duration: 0.6, stagger: 0.05, ease: 'power4.out' }, '-=0.35')
    .from('.drawer .btn, .drawer__foot', { autoAlpha: 0, y: 20, duration: 0.5, stagger: 0.08 }, '-=0.35');
  function toggleDrawer(open: boolean) {
    drawerOpen = open;
    drawer.classList.toggle('is-open', open);
    nav.classList.toggle('menu-open', open);
    nav.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    lockScroll(open);
    open ? dTl.timeScale(1).play() : dTl.timeScale(1.6).reverse();
  }
  burger.addEventListener('click', () => toggleDrawer(!drawerOpen));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawerOpen) toggleDrawer(false); });
  $$('.drawer a').forEach((a) => a.addEventListener('click', () => drawerOpen && toggleDrawer(false)));

  // ticker loop
  const track = $('.ticker__track');
  if (track && !REDUCED) gsap.to(track, { xPercent: -50, duration: 30, ease: 'none', repeat: -1 });

  // footer wordmark
  if (!REDUCED) {
    gsap.from('[data-foot-word] .wordmark', { yPercent: 100, duration: 1.4, ease: 'power4.out', scrollTrigger: { trigger: '.foot__big', start: 'top 95%', once: true } });
    gsap.fromTo('[data-foot-word] .wordmark', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: 0.8 } });
    gsap.from('.foot__big .acc', { y: -120, rotate: -40, duration: 1.2, ease: 'bounce.out', scrollTrigger: { trigger: '.foot__big', start: 'top 85%', once: true } });
  }
}

/* ---------- cursor, magnetic buttons, tilt (mouse only) ---------- */
function pointer() {
  if (REDUCED || !FINE) return;
  const cur = $('#cursor')!, dot = $('.cursor__dot')!, ring = $('.cursor__ring')!, label = $('.cursor__label')!;
  const q = (el: Element, p: string, d: number) => gsap.quickTo(el, p, { duration: d, ease: 'power3' });
  const dx = q(dot, 'x', 0.1), dy = q(dot, 'y', 0.1), rx = q(ring, 'x', 0.45), ry = q(ring, 'y', 0.45), lx = q(label, 'x', 0.45), ly = q(label, 'y', 0.45);
  let shown = false;
  window.addEventListener('pointermove', (e) => {
    if (!shown) { shown = true; gsap.to(cur, { autoAlpha: 1, duration: 0.3 }); }
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); lx(e.clientX); ly(e.clientY);
  });
  document.addEventListener('pointerleave', () => { shown = false; gsap.to(cur, { autoAlpha: 0, duration: 0.3 }); });

  // delegated so elements added later (quote wizard) still get the label
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cursor]');
    if (!el || el.contains(e.relatedTarget as Node)) return;
    label.textContent = el.dataset.cursor || '';
    gsap.to(ring, { scale: 2.2, backgroundColor: 'rgba(184,92,56,.92)', borderColor: 'rgba(0,0,0,0)', duration: 0.4, ease: 'power3.out' });
    gsap.to(dot, { scale: 0, duration: 0.3 });
    gsap.to(label, { autoAlpha: 1, duration: 0.3 });
  });
  document.addEventListener('pointerout', (e) => {
    const el = (e.target as Element).closest('[data-cursor]');
    if (!el || el.contains(e.relatedTarget as Node)) return;
    gsap.to(ring, { scale: 1, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(184,92,56,.5)', duration: 0.4, ease: 'power3.out' });
    gsap.to(dot, { scale: 1, duration: 0.3 });
    gsap.to(label, { autoAlpha: 0, duration: 0.2 });
  });

  $$('.magnetic').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.3);
      my((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });

  $$('[data-tilt]').forEach((card) => {
    gsap.set(card, { transformPerspective: 900 });
    const tx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ty = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      ty(((e.clientX - r.left) / r.width - 0.5) * 12);
      tx(-((e.clientY - r.top) / r.height - 0.5) * 12);
    });
    card.addEventListener('pointerleave', () => { tx(0); ty(0); });
  });
}

/* ---------- boot ---------- */
function reveal(sel: string) { $$(sel).forEach((el) => (el.style.visibility = 'visible')); }

function boot() {
  chrome();
  pointer();
  pages.forEach((p) => p.setup?.());
  reveals();
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  runLoader().then(() => {
    reveal('[data-intro], [data-hero-line], [data-hero-lede]');
    const intros = REDUCED ? [] : pages.map((p) => p.intro?.()).filter(Boolean) as gsap.core.Timeline[];
    const startAmbient = () => { floats(); pages.forEach((p) => p.ambient?.()); };
    if (intros.length) intros[0].eventCallback('onComplete', startAmbient);
    else startAmbient();
  });
}

const ready = Promise.all([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise<void>((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', () => r(), { once: true }))),
]);

// Never wait longer than 2.5s for slow images on mobile data.
Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  try {
    boot();
  } catch (err) {
    console.error('[mynsera] motion boot failed:', err);
    html.classList.remove('js', 'has-loader', 'is-loading');
    if (lenis) lenis.start();
  }
});

// images that finish loading late change layout; re-measure once
window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
