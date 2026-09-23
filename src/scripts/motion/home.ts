/* =========================================================
   Home page motion
   ========================================================= */
import { gsap, ScrollTrigger, SplitText, REDUCED, FINE, $, $$, registerPage } from './core';

function intro() {
  const lede = $('[data-hero-lede]');
  const split = lede ? SplitText.create(lede, { type: 'lines,words', mask: 'lines', linesClass: 'split-line' }) : null;

  gsap.set('.hero__arch', { clipPath: 'inset(100% 0% 0% 0% round 50% 50% 26px 26px)' });
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.nav .brand, .nav__links a, .nav__tools > *', { y: -24, autoAlpha: 0, duration: 0.8, stagger: 0.05 }, 0)
    .from('.hero__bloom', { scale: 0.5, autoAlpha: 0, duration: 1.8, ease: 'power2.out' }, 0)
    .from('.hero .eyebrow', { y: 18, autoAlpha: 0, duration: 0.7 }, 0.15)
    .from('[data-hero-line]', { yPercent: 118, rotate: 4, duration: 1.2, stagger: 0.1 }, 0.2)
    .to('.hero__arch', { clipPath: 'inset(0% 0% 0% 0% round 50% 50% 26px 26px)', duration: 1.4, ease: 'expo.out' }, 0.3)
    .from('.hero__arch img', { scale: 1.6, duration: 1.9, ease: 'expo.out' }, 0.3)
    .fromTo('.hero__shine', { xPercent: -130 }, { xPercent: 130, duration: 1.4, ease: 'power2.inOut' }, 1)
    .from(split ? split.words : [], { yPercent: 110, duration: 0.8, stagger: 0.012 }, 0.55)
    .from('.hero__cta .btn', { y: 26, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.8)
    .from('.hero__trust li', { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.9)
    .fromTo('.hero__card', { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1, stagger: 0.12, ease: 'back.out(1.7)' }, 0.9)
    .fromTo('.hero__petal', { scale: 0, rotate: -120, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 0.55, duration: 1.1, stagger: 0.1, ease: 'back.out(2)' }, 1)
    .from('.hero__scroll', { autoAlpha: 0, y: 14, duration: 0.7 }, 1.3);
  return tl;
}

function ambient() {
  $$('.hero__petal').forEach((el, i) => {
    gsap.to(el, { y: 'random(-20,20)', x: 'random(-16,16)', duration: 4 + i, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatRefresh: true });
    gsap.to(el, { rotation: '+=360', duration: 26 + i * 8, ease: 'none', repeat: -1 });
  });
  gsap.to('.hero__bloom', { scale: 1.08, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

function setup() {
  if (REDUCED) return;

  /* hero: scroll-away parallax + pointer depth */
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
    .to('.hero__copy', { yPercent: 18, autoAlpha: 0.2 }, 0)
    .to('.hero__arch', { yPercent: -10, scale: 0.92, rotate: -2 }, 0)
    .to('.hero__arch img', { yPercent: 10 }, 0)
    .to('.hero__card--a', { yPercent: -80, xPercent: -20 }, 0)
    .to('.hero__card--b', { yPercent: -120, xPercent: 20 }, 0)
    .to('.hero__bloom', { yPercent: 30, scale: 1.3 }, 0);

  if (FINE) {
    const media = $('[data-hero-media]');
    const layers = $$('[data-depth]').map((el) => ({
      d: +el.dataset.depth!,
      x: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3' }),
      y: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3' }),
    }));
    const arch = $('.hero__arch');
    const rx = gsap.quickTo(arch, 'rotationY', { duration: 1, ease: 'power3' });
    const ry = gsap.quickTo(arch, 'rotationX', { duration: 1, ease: 'power3' });
    $('.hero')!.addEventListener('pointermove', (e) => {
      if (!media) return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      layers.forEach((l) => { l.x(nx * 18 * l.d); l.y(ny * 14 * l.d); });
      rx(nx * 8); ry(-ny * 6);
    });
  }

  /* velocity-reactive marquee rows (opposite directions) */
  $$('[data-marquee]').forEach((row) => {
    const dir = +row.dataset.marquee!;
    row.appendChild(row.firstElementChild!.cloneNode(true));
    const loop = gsap.fromTo(row, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 28, ease: 'none', repeat: -1 });
    const skew = gsap.quickTo(row, 'skewX', { duration: 0.4, ease: 'power3' });
    const settle = gsap.delayedCall(0.3, () => { skew(0); gsap.to(loop, { timeScale: 1, duration: 0.8 }); }).pause();
    ScrollTrigger.create({
      trigger: '.strip', start: 'top bottom', end: 'bottom top',
      onUpdate(self) {
        const v = self.getVelocity();
        skew(gsap.utils.clamp(-10, 10, (v / 400) * dir));
        loop.timeScale(gsap.utils.clamp(1, 6, 1 + Math.abs(v) / 600));
        settle.restart(true);
      },
    });
  });

  /* what we make: the catalogue grid */
  const mm = gsap.matchMedia();
  catalog(mm);

  /* process: rail fills, steps light up */
  const steps = $$('[data-process-step]');
  gsap.to('[data-process-fill]', {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '[data-process]', start: 'top 60%', end: 'bottom 60%', scrub: 0.4 },
  });
  steps.forEach((s) => {
    ScrollTrigger.create({ trigger: s, start: 'top 62%', onToggle: (self) => s.classList.toggle('is-on', self.isActive || self.progress > 0), end: 'max' });
    gsap.from(s.querySelector('div'), { x: 40, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
  });

  /* gallery */
  gallery(mm);

  /* final CTA grows out of the page */
  gsap.fromTo('[data-cta]', { scale: 0.86, borderRadius: 80 }, {
    scale: 1, borderRadius: 36, ease: 'none',
    scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top 35%', scrub: 0.6 },
  });
  gsap.to('.cta__leaf', { rotate: 70, y: -60, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });

  /* section tint: the page warms toward blush as you reach packages */
  gsap.fromTo('.pk', { backgroundColor: 'rgba(243,221,205,0)' }, {
    backgroundColor: 'rgba(243,221,205,.55)', ease: 'none',
    scrollTrigger: { trigger: '.pk', start: 'top 70%', end: 'center center', scrub: true },
  });
}

/* ---------------------------------------------------------
   Catalogue grid (inspired by Codrops' Sticky Grid Scroll and
   Infinite Parallax Grid, without pinning, which is fragile in
   Instagram's in-app browser):
   1. the cards assemble from a scattered pile at the centre as
      the section scrolls in, images wiping open
   2. while you pass, alternate columns drift opposite ways and
      each photo drifts inside its frame
   Phones get a lighter staggered rise instead of the scatter.
   --------------------------------------------------------- */
function catalog(mm: gsap.MatchMedia) {
  const grid = $('[data-catalog]');
  if (!grid) return;
  const items = $$('[data-cat-item]', grid);
  const cards = items.map((i) => i.querySelector<HTMLElement>('.cat__card')!);
  const media = items.map((i) => i.querySelector<HTMLElement>('[data-cat-media]')!);
  const imgs = items.map((i) => i.querySelector<HTMLElement>('[data-cat-media] img, [data-cat-media] .ph')!);

  mm.add('(min-width: 901px)', () => {
    // where each card sits relative to the middle of the grid, and which
    // on-screen column it is in (the list order doesn't tell you that)
    const g = grid.getBoundingClientRect();
    const cx = g.left + g.width / 2;
    // the pile sits just inside the top of the grid: on screen from the
    // moment the section arrives, and clear of the heading above it
    const cy = g.top + 110;
    const lefts = [...new Set(items.map((el) => Math.round(el.getBoundingClientRect().left)))].sort((a, b) => a - b);
    const info = items.map((el) => {
      const r = el.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2);
      const dy = cy - (r.top + r.height / 2);
      return { dx, dy, dist: Math.hypot(dx, dy), col: lefts.indexOf(Math.round(r.left)) };
    });
    const far = Math.max(...info.map((o) => o.dist)) || 1;

    // 1. assemble while it's on screen: starts as the grid enters, finishes
    //    as its middle reaches the middle of the screen, rippling outwards
    const tl = gsap.timeline({
      scrollTrigger: { trigger: grid, start: 'top 78%', end: 'center 55%', scrub: 0.9 },
    });
    // the deck appears at once, as a fanned pile
    tl.fromTo(items, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, stagger: 0.012, ease: 'none' }, 0);
    items.forEach((el, i) => {
      const o = info[i];
      const at = 0.08 + (o.dist / far) * 0.5;
      tl.fromTo(el,
        { x: o.dx, y: o.dy, rotation: gsap.utils.random(-18, 18), scale: 0.5 },
        { x: 0, y: 0, rotation: 0, scale: 1, ease: 'power2.inOut', duration: 1, immediateRender: true }, at)
        .fromTo(media[i], { clipPath: 'inset(100% 0% 0% 0% round 14px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.out', duration: 0.7 }, at + 0.25)
        .fromTo(imgs[i], { scale: 1.5 }, { scale: 1, ease: 'power2.out', duration: 1 }, at + 0.2);
    });

    // 2. once assembled, alternate columns drift opposite ways while you
    //    pass (on the card, so it never fights the assembly on the item)
    cards.forEach((c, i) => {
      const dir = info[i].col % 2 ? -1 : 1;
      gsap.fromTo(c, { yPercent: 0 }, {
        yPercent: -9 * dir, ease: 'none',
        scrollTrigger: { trigger: grid, start: 'center 55%', end: 'bottom top', scrub: 0.6 },
      });
    });

    return () => tl.kill();
  });

  mm.add('(max-width: 900px)', () => {
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) =>
        gsap.fromTo(batch, { y: 70, rotation: (i) => (i % 2 ? 4 : -4), autoAlpha: 0 }, {
          y: 0, rotation: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true,
        }),
    });
    media.forEach((m) =>
      gsap.fromTo(m, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: m, start: 'top 92%', once: true },
      }));
    // two columns, gently out of step while you scroll
    cards.forEach((c, i) =>
      gsap.fromTo(c, { yPercent: i % 2 ? 6 : -2 }, {
        yPercent: i % 2 ? -6 : 2, ease: 'none',
        scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      }));
  });

  // every photo drifts inside its frame, on all screen sizes
  imgs.forEach((im) =>
    gsap.fromTo(im, { yPercent: -5 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: im.closest('.cat__item'), start: 'top bottom', end: 'bottom top', scrub: true },
    }));
}

function gallery(mm: gsap.MatchMedia) {
  const track = $('#galTrack');
  if (!track) return;
  const items = $$('.gal__item', track);

  mm.add('(min-width: 901px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.gal', start: 'top top', end: () => '+=' + dist(), pin: '.gal__pin', scrub: 0.8,
        invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => gsap.set('#galBar', { scaleX: self.progress }),
      },
    });
    items.forEach((item, i) => {
      gsap.fromTo(item, { y: i % 2 ? 50 : -30, rotate: i % 2 ? 2 : -2 }, {
        y: i % 2 ? -30 : 50, rotate: i % 2 ? -2 : 2, ease: 'none',
        scrollTrigger: { trigger: item, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.fromTo(item.querySelector('img'), { scale: 1.35 }, {
        scale: 1.05, ease: 'none',
        scrollTrigger: { trigger: item, containerAnimation: tween, start: 'left right', end: 'center center', scrub: true },
      });
    });
  });

  // touch: native swipe, but items still react to their position
  mm.add('(max-width: 900px)', () => {
    gsap.from($$('.gal__img', track), { x: 80, autoAlpha: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: track, start: 'top 85%', once: true } });
    const bar = $('#galBar');
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerWidth / 2;
      items.forEach((it) => {
        const r = it.getBoundingClientRect();
        const d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / window.innerWidth);
        gsap.set(it, { scale: 1 - d * 0.14, rotate: ((r.left + r.width / 2 - mid) / window.innerWidth) * 6 });
      });
      if (bar) gsap.set(bar, { scaleX: track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth) });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    track.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => track.removeEventListener('scroll', onScroll);
  });
}

registerPage({ setup, intro, ambient });
