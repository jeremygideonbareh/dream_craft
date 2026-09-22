/* =========================================================
   Generic scroll motion, driven entirely by data attributes so any
   page gets it for free:

   data-split="chars|words|lines"   masked text reveal on enter
   data-scrub-text                  words brighten as you scroll through
   data-reveal="up|left|right|fade|scale"  element reveal on enter
   data-reveal-group                children reveal with a stagger
   data-img-reveal                  clip-path wipe + scale settle, then parallax
   data-count="18000"               number counts up on enter
   data-float="1|-1"                idle bobbing
   data-parallax="0.15"             scrubbed drift
   data-skew                        leans with scroll velocity
   data-bg="#hex"                   page colour shifts to this while in view
   data-drift="0.1"                 image drifts inside its frame as you pass
   data-thread                      a line that draws itself as you scroll
   .ph .draw                        placeholder line-art draws itself
   ========================================================= */
import { gsap, ScrollTrigger, SplitText, REDUCED, $$, inr } from './core';

const enter = (trigger: Element, start = 'top 86%') => ({ trigger, start, once: true });

export function reveals() {
  if (REDUCED) {
    $$('[data-count]').forEach((el) => (el.textContent = inr(+el.dataset.count!)));
    return;
  }

  /* text */
  $$('[data-split]').forEach((el) => {
    const kind = el.dataset.split as 'chars' | 'words' | 'lines';
    SplitText.create(el, {
      type: kind === 'chars' ? 'lines,words,chars' : kind === 'words' ? 'lines,words' : 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit(self) {
        const targets = kind === 'chars' ? self.chars : kind === 'words' ? self.words : self.lines;
        return gsap.from(targets, {
          yPercent: 115,
          rotate: kind === 'chars' ? 6 : 0,
          duration: kind === 'chars' ? 1 : 0.9,
          ease: 'power4.out',
          stagger: kind === 'chars' ? 0.018 : kind === 'words' ? 0.02 : 0.08,
          scrollTrigger: enter(el),
        });
      },
    });
  });

  $$('[data-scrub-text]').forEach((el) => {
    SplitText.create(el, {
      type: 'words',
      autoSplit: true,
      onSplit(self) {
        return gsap.fromTo(self.words, { opacity: 0.14 }, {
          opacity: 1, ease: 'none', stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true },
        });
      },
    });
  });

  /* elements */
  const from: Record<string, gsap.TweenVars> = {
    up: { y: 60, autoAlpha: 0 },
    left: { x: -40, autoAlpha: 0 },
    right: { x: 40, autoAlpha: 0 },
    fade: { autoAlpha: 0 },
    scale: { scale: 0.86, autoAlpha: 0 },
  };
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { ...from[el.dataset.reveal || 'up'], duration: 1, ease: 'power3.out', scrollTrigger: enter(el) });
  });
  $$('[data-reveal-group]').forEach((group) => {
    gsap.from(group.children, {
      y: 70, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.09,
      scrollTrigger: enter(group, 'top 84%'),
    });
  });

  /* eyebrow rules draw in */
  $$('.eyebrow i').forEach((i) => gsap.from(i, { scaleX: 0, duration: 1, ease: 'power3.inOut', scrollTrigger: enter(i, 'top 92%') }));

  /* images */
  $$('[data-img-reveal]').forEach((frame) => {
    const im = frame.querySelector('img');
    gsap.timeline({ scrollTrigger: enter(frame, 'top 80%') })
      .fromTo(frame, { clipPath: 'inset(100% 0% 0% 0% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.4, ease: 'expo.out' })
      .from(im, { scale: 1.4, duration: 1.8, ease: 'expo.out' }, 0);
    if (im) {
      gsap.fromTo(im, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });

  $$('[data-parallax]').forEach((el) => {
    const amt = +(el.dataset.parallax || 0.15) * 100;
    gsap.fromTo(el, { yPercent: -amt / 2 }, {
      yPercent: amt / 2, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* numbers */
  // The real number stays in the page: it is only blanked once the count-up
  // actually starts, so a throttled or blocked animation can never leave a
  // price showing 0.
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count!;
    const o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.8, ease: 'power3.out',
      onUpdate: () => (el.textContent = inr(Math.round(o.v))),
      onComplete: () => (el.textContent = inr(to)),
      scrollTrigger: enter(el, 'top 90%'),
    });
  });

  /* placeholder line art */
  $$<SVGPathElement>('.ph .draw').forEach((p) => {
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', scrollTrigger: enter(p, 'top 90%'),
    });
  });

  /* the page itself changes colour as you travel down it */
  const bgSections = $$('[data-bg]');
  if (bgSections.length) {
    const body = document.body;
    const base = getComputedStyle(body).backgroundColor;
    bgSections.forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 60%',
        end: 'bottom 40%',
        onToggle: (self) =>
          gsap.to(body, { backgroundColor: self.isActive ? sec.dataset.bg! : base, duration: 0.8, ease: 'power2.out', overwrite: 'auto' }),
      });
    });
  }

  /* photographs drift inside their frames, so nothing sits perfectly still */
  $$('[data-drift]').forEach((el) => {
    const amt = +(el.dataset.drift || 0.08) * 100;
    gsap.fromTo(el, { yPercent: -amt, scale: 1 + amt / 90 }, {
      yPercent: amt, ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* hand-drawn threads that draw themselves as they cross the screen */
  $$<SVGPathElement>('[data-thread] path').forEach((path) => {
    const len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: path.closest('[data-thread]'), start: 'top 90%', end: 'bottom 55%', scrub: 0.6 },
    });
  });

  /* velocity lean */
  const skewers = $$('[data-skew]');
  if (skewers.length) {
    const set = gsap.quickTo(skewers, 'skewY', { duration: 0.6, ease: 'power3' });
    ScrollTrigger.create({
      onUpdate: (self) => set(gsap.utils.clamp(-4, 4, self.getVelocity() / -400)),
    });
    ScrollTrigger.addEventListener('scrollEnd', () => set(0));
  }
}

export function floats() {
  if (REDUCED) return;
  $$('[data-float]').forEach((el, i) => {
    const dir = +(el.dataset.float || 1);
    gsap.to(el, { y: 14 * dir, rotate: 2 * dir, duration: 3.2 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  });
}
