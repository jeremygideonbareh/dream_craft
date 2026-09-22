/* =========================================================
   Work page: category filter with Flip re-layout
   ========================================================= */
import { gsap, ScrollTrigger, Flip, REDUCED, $, $$, registerPage } from './core';

function setup() {
  const grid = $('#workGrid')!;
  const tiles = $$('.tile', grid);
  const buttons = $$<HTMLButtonElement>('[data-filter]');
  const empty = $('#workEmpty')!;
  const emptyCta = $<HTMLAnchorElement>('#workEmptyCta')!;
  const quoteBase = emptyCta.getAttribute('href')!;

  if (!REDUCED) {
    ScrollTrigger.batch(tiles, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.from(batch, { y: 80, scale: 0.94, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'power3.out', overwrite: true }),
    });
  }

  function apply(cat: string, animate = true) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
    const state = Flip.getState(tiles);
    tiles.forEach((t) => t.classList.toggle('is-hidden', cat !== 'all' && t.dataset.cat !== cat));
    const none = tiles.every((t) => t.classList.contains('is-hidden'));
    empty.hidden = !none;
    emptyCta.href = cat === 'all' ? quoteBase : `${quoteBase}?product=${cat}`;
    if (animate && !REDUCED) {
      Flip.from(state, {
        duration: 0.7, ease: 'power3.inOut', absolute: true, scale: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.6 }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.8, duration: 0.4 }),
        onComplete: () => ScrollTrigger.refresh(),
      });
      if (none) gsap.from(empty, { y: 30, autoAlpha: 0, duration: 0.6 });
    }
    const u = new URL(location.href);
    cat === 'all' ? u.searchParams.delete('c') : u.searchParams.set('c', cat);
    history.replaceState(null, '', u);
  }

  buttons.forEach((b) => b.addEventListener('click', () => {
    apply(b.dataset.filter!);
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }));

  const initial = new URLSearchParams(location.search).get('c');
  if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial, false);
}

registerPage({ setup });
