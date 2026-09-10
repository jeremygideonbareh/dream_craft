/* =========================================================
   Dream Craft — motion system
   GSAP + ScrollTrigger + Lenis
   ========================================================= */
(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  document.body.classList.add('is-loading');
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     1. SMOOTH SCROLL (Lenis) wired into ScrollTrigger
     --------------------------------------------------------- */
  var lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  }
  // never let a slow frame stretch the clock into slow motion
  gsap.ticker.lagSmoothing(0);

  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.3 });
    else { var el = $(target); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  }

  /* ---------------------------------------------------------
     2. TEXT SPLITTING (lines / words / chars) — no paid plugin
     --------------------------------------------------------- */
  function splitWords(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    var frag = document.createDocumentFragment();
    var out = [];
    text.split(' ').forEach(function (w, i) {
      var mask = document.createElement('span');
      mask.className = 'sp-line';
      mask.style.display = 'inline-block';
      mask.style.verticalAlign = 'top';
      var inner = document.createElement('span');
      inner.className = 'sp-word';
      inner.textContent = w;
      mask.appendChild(inner);
      frag.appendChild(mask);
      if (i < text.split(' ').length - 1) frag.appendChild(document.createTextNode(' '));
      out.push(inner);
    });
    el.appendChild(frag);
    return out;
  }

  function splitChars(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    var frag = document.createDocumentFragment();
    var out = [];
    text.split(' ').forEach(function (word, wi, arr) {
      var wrapEl = document.createElement('span');
      wrapEl.style.display = 'inline-block';
      wrapEl.style.overflow = 'hidden';
      wrapEl.style.verticalAlign = 'top';
      wrapEl.style.paddingBottom = '0.08em';
      word.split('').forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'sp-char';
        c.textContent = ch;
        wrapEl.appendChild(c);
        out.push(c);
      });
      frag.appendChild(wrapEl);
      if (wi < arr.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    el.appendChild(frag);
    return out;
  }

  /* ---------------------------------------------------------
     3. PRELOADER  →  hands off to the hero timeline
     --------------------------------------------------------- */
  function buildLoader(onDone) {
    var loader   = $('#loader');
    var countEl  = $('#loaderCount');
    var strokes  = $$('.ldraw');

    // prep SVG stroke drawing
    strokes.forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 300;
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });

    if (REDUCED) {
      gsap.set(loader, { autoAlpha: 0, display: 'none' });
      document.body.classList.remove('is-loading');
      onDone();
      return;
    }

    var counter = { v: 0 };

    var tl = gsap.timeline({
      onComplete: function () {
        loader.style.display = 'none';
        document.body.classList.remove('is-loading');
        if (lenis) lenis.start();
        onDone();
      }
    });

    tl.from('.loader__word span', {
        yPercent: 115, rotate: 6, duration: 1, stagger: .09, ease: 'power4.out'
      })
      .to(strokes, {
        strokeDashoffset: 0, duration: 1.5, stagger: .14, ease: 'power2.inOut'
      }, .1)
      .to('.loader__mark', { rotate: 180, duration: 2.4, ease: 'power2.inOut' }, .1)
      .to('.loader__bar i', { scaleX: 1, duration: 2, ease: 'power2.inOut' }, .2)
      .to(counter, {
        v: 100, duration: 2, ease: 'power2.inOut',
        onUpdate: function () { countEl.textContent = Math.round(counter.v); }
      }, .2)
      .to('.loader__meta, .loader__bar', { autoAlpha: 0, duration: .4 }, '+=.15')
      .to('.loader__mark', { scale: .4, autoAlpha: 0, duration: .6, ease: 'power3.in' }, '-=.35')
      .to('.loader__word span', {
        yPercent: -115, duration: .8, stagger: .07, ease: 'power3.inOut'
      }, '-=.45')
      // curtain: vertical panels sweep up with stagger
      .to('.loader__panels span', {
        yPercent: -101, duration: 1.05, stagger: { each: .07, from: 'start' }, ease: 'expo.inOut'
      }, '-=.4');

    return tl;
  }

  /* ---------------------------------------------------------
     4. HERO INTRO
     --------------------------------------------------------- */
  function heroIntro() {
    // Reduced motion: land straight on the finished state, animate nothing.
    if (REDUCED) {
      gsap.set('.hero__arch', { clipPath: 'none' });
      $$('.count').forEach(function (el) { el.textContent = el.dataset.to; });
      return null;
    }

    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    gsap.set('.hero__arch', { clipPath: 'inset(100% 0% 0% 0%)' });

    tl.from('.ticker', { yPercent: -100, duration: .7, ease: 'power3.out' })
      .from('.nav .brand', { y: -22, autoAlpha: 0, duration: .8 }, '-=.4')
      .from('.nav__links a', { y: -18, autoAlpha: 0, duration: .7, stagger: .06 }, '<.05')
      .from('.nav__tools > *', { y: -18, autoAlpha: 0, duration: .7, stagger: .05 }, '<.05')

      .from('.hero__bloom', { scale: .6, autoAlpha: 0, duration: 1.6, ease: 'power2.out' }, 0)

      .from('.eyebrow[data-fade]', { y: 18, autoAlpha: 0, duration: .7 }, '-=.5')
      .from('[data-hero-line]', {
        yPercent: 118, rotate: 4, duration: 1.15, stagger: .09
      }, '-=.45')

      .to('.hero__arch', {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'expo.out'
      }, '-=1.05')
      .from('.hero__arch img', { scale: 1.55, duration: 1.8, ease: 'expo.out' }, '<')
      .fromTo('.hero__shine',
        { xPercent: -130 },
        { xPercent: 130, duration: 1.4, ease: 'power2.inOut' }, '-=.85')

      .fromTo('.hero__lede .sp-word',
        { yPercent: 105 },
        { yPercent: 0, duration: .85, stagger: .014 }, '-=1.1')
      .fromTo('.hero__cta .btn',
        { y: 26, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: .8, stagger: .1 }, '-=.7')
      .fromTo('.hero__stats li',
        { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: .8, stagger: .08 }, '-=.6')

      // fromTo (not from) so the ambient float tweens on these same elements
      // can never be mistaken for the resting state.
      .fromTo('.hero__card',
        { scale: .5, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 1, stagger: .12, ease: 'back.out(1.7)' }, '-=.85')
      .fromTo('.hero__petal',
        { scale: 0, rotate: -120, autoAlpha: 0 },
        { scale: 1, rotate: 0, autoAlpha: 1, duration: 1.1, stagger: .1, ease: 'back.out(2)' }, '-=.9')
      .fromTo('.hero__scroll',
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: .7 }, '-=.5');

    // counters
    $$('.count').forEach(function (el) {
      var to = +el.dataset.to;
      tl.to(el, {
        textContent: to, duration: 1.6, ease: 'power2.out', snap: { textContent: 1 }
      }, '-=1.6');
    });

    return tl;
  }

  /* ---------------------------------------------------------
     5. AMBIENT LOOPS (never stop moving)
     --------------------------------------------------------- */
  function ambient() {
    if (REDUCED) return;

    $$('[data-float]').forEach(function (el, i) {
      var dir = +el.dataset.float || 1;
      gsap.to(el, {
        y: 13 * dir, rotate: 1.6 * dir,
        duration: 3.2 + i * .45, ease: 'sine.inOut',
        yoyo: true, repeat: -1
      });
    });

    $$('.hero__petal').forEach(function (el, i) {
      gsap.to(el, {
        y: 'random(-18,18)', x: 'random(-14,14)', rotate: 'random(-25,25)',
        duration: 4 + i, ease: 'sine.inOut', yoyo: true, repeat: -1
      });
      gsap.to(el, { rotation: '+=360', duration: 26 + i * 8, ease: 'none', repeat: -1 });
    });

    gsap.to('.hero__bloom', {
      scale: 1.07, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1
    });

    // announcement ticker
    var track = $('.ticker__track');
    if (track) {
      gsap.to(track, {
        xPercent: -50, duration: 26, ease: 'none', repeat: -1,
        modifiers: { xPercent: gsap.utils.wrap(-50, 0) }
      });
    }
  }

  /* ---------------------------------------------------------
     6. SCROLL SYSTEM
     --------------------------------------------------------- */
  function scrollSystem() {

    /* --- progress bar --- */
    gsap.to('#progressBar', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .3 }
    });

    /* --- sticky nav state --- */
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: function (self) {
        $('#nav').classList.toggle('is-stuck', self.scroll() > 60);
      }
    });

    // Everything below is decorative motion — skipped entirely for reduced motion.
    if (REDUCED) return;

    /* --- hero parallax on scroll --- */
    gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
    })
      .to('.hero__copy',  { yPercent: 22, autoAlpha: .15 }, 0)
      .to('.hero__arch',  { yPercent: -14, scale: .93 }, 0)
      .to('.hero__arch img', { yPercent: 12 }, 0)
      .to('.hero__card--a', { yPercent: -70, xPercent: -18 }, 0)
      .to('.hero__card--b', { yPercent: -110, xPercent: 18 }, 0)
      .to('.hero__bloom', { yPercent: 30, scale: 1.25 }, 0);

    /* --- velocity-reactive marquee strip --- */
    var strip = $('[data-marquee]');
    if (strip) {
      // duplicate the set so the loop is seamless
      strip.appendChild(strip.firstElementChild.cloneNode(true));
      var stripTween = gsap.to(strip, {
        xPercent: -50, duration: 20, ease: 'none', repeat: -1,
        modifiers: { xPercent: gsap.utils.wrap(-50, 0) }
      });
      var skewSetter = gsap.quickSetter(strip, 'skewX', 'deg');
      var scaleSetter = gsap.quickTo(strip, 'scaleY', { duration: .5, ease: 'power3' });

      var resetSkew = gsap.delayedCall(.4, function () {
        gsap.to(strip, { skewX: 0, duration: .5, ease: 'power3' });
        stripTween.timeScale(1);
        scaleSetter(1);
      }).pause();

      ScrollTrigger.create({
        onUpdate: function (self) {
          var v = self.getVelocity();
          skewSetter(gsap.utils.clamp(-8, 8, v / 500));
          stripTween.timeScale(gsap.utils.clamp(.4, 6, 1 + Math.abs(v) / 900));
          scaleSetter(1 + Math.min(Math.abs(v) / 26000, .12));
          resetSkew.restart(true);
        }
      });
    }

    /* --- generic word / char reveals --- */
    $$('[data-split-words]').forEach(function (el) {
      var words = splitWords(el);
      if (el.closest('.hero')) return; // hero handled by intro timeline
      gsap.from(words, {
        yPercent: 108, duration: .95, ease: 'power4.out', stagger: .016,
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    $$('[data-split-chars]').forEach(function (el) {
      var chars = splitChars(el);
      gsap.from(chars, {
        yPercent: 110, rotate: 5, duration: 1, ease: 'power4.out', stagger: .022,
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    /* --- USP strip + icon line draw --- */
    gsap.from('[data-usp]', {
      y: 46, autoAlpha: 0, duration: .95, ease: 'power3.out', stagger: .1,
      scrollTrigger: { trigger: '.usp', start: 'top 85%' }
    });
    $$('.usp .draw, .occ .draw').forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 200;
      gsap.fromTo(p,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut',
          scrollTrigger: { trigger: p.closest('article, li'), start: 'top 88%' }
        });
    });

    /* --- collection cards: rise + inner image counter-parallax --- */
    gsap.from('[data-card]', {
      y: 90, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: .1,
      scrollTrigger: { trigger: '.cards', start: 'top 84%' }
    });
    $$('.card__img img').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: img.closest('.card'), start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* --- story panel --- */
    gsap.from('.story__panel', {
      y: 70, autoAlpha: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.story', start: 'top 82%' }
    });
    gsap.fromTo('.story__frame img',
      { scale: 1.3, yPercent: -6 },
      {
        scale: 1.05, yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: .5 }
      });
    gsap.from('.story__badge', {
      scale: 0, rotate: -90, duration: 1, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: '.story', start: 'top 70%' }
    });
    gsap.from('.story .btn', {
      y: 26, autoAlpha: 0, duration: .8,
      scrollTrigger: { trigger: '.story .btn', start: 'top 92%' }
    });

    /* --- occasion circles --- */
    gsap.from('[data-occ]', {
      y: 60, scale: .72, autoAlpha: 0, duration: .9, ease: 'back.out(1.5)', stagger: .075,
      scrollTrigger: { trigger: '.occ__grid', start: 'top 85%' }
    });

    /* --- bestsellers --- */
    gsap.from('[data-prod]', {
      y: 80, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: .09,
      scrollTrigger: { trigger: '.best__grid', start: 'top 84%' }
    });
    $$('.prod__img img').forEach(function (img) {
      gsap.fromTo(img, { scale: 1.14, yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.closest('.prod'), start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* --- quote --- */
    gsap.from('.quote__by', {
      autoAlpha: 0, y: 18, duration: .8,
      scrollTrigger: { trigger: '.quote', start: 'top 72%' }
    });

    /* --- newsletter panel --- */
    gsap.from('[data-news]', {
      y: 70, autoAlpha: 0, scale: .96, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.news', start: 'top 85%' }
    });
    gsap.to('.news__leaf', {
      rotate: 40, y: -22, ease: 'none',
      scrollTrigger: { trigger: '.news', start: 'top bottom', end: 'bottom top', scrub: .6 }
    });

    /* --- footer wordmark --- */
    gsap.from('[data-foot-word] span', {
      yPercent: 105, duration: 1.3, ease: 'power4.out',
      scrollTrigger: { trigger: '.foot__big', start: 'top 92%' }
    });
    gsap.to('[data-foot-word] span', {
      xPercent: -4, ease: 'none',
      scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: .8 }
    });
    gsap.from('.foot__col', {
      y: 40, autoAlpha: 0, duration: .9, ease: 'power3.out', stagger: .08,
      scrollTrigger: { trigger: '.foot__top', start: 'top 88%' }
    });
  }

  /* ---------------------------------------------------------
     7. PINNED HORIZONTAL GALLERY (desktop only)
     --------------------------------------------------------- */
  function horizontalGallery() {
    // Reduced motion: leave the row as a plain, natively scrollable strip.
    if (REDUCED) {
      var t = $('#galTrack');
      if (t) {
        t.style.overflowX = 'auto';
        t.style.paddingBottom = '1rem';
        $('.gal__pin').style.height = 'auto';
      }
      return;
    }

    var mm = gsap.matchMedia();

    mm.add('(min-width: 901px)', function () {
      var track = $('#galTrack');
      if (!track) return;

      var getDistance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth + 40);
      };

      var tween = gsap.to(track, {
        x: function () { return -getDistance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: '.gal',
          start: 'top top',
          end: function () { return '+=' + getDistance(); },
          pin: '.gal__pin',
          scrub: .8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: function (self) {
            gsap.set('#galBar', { scaleX: self.progress });
          }
        }
      });

      // each tile drifts + fades slightly as it crosses the viewport
      $$('.gal__item').forEach(function (item, i) {
        gsap.fromTo(item,
          { y: i % 2 ? 44 : -26, rotate: i % 2 ? 1.6 : -1.6 },
          {
            y: i % 2 ? -26 : 44, rotate: i % 2 ? -1.6 : 1.6, ease: 'none',
            scrollTrigger: {
              trigger: item,
              containerAnimation: tween,
              start: 'left right',
              end: 'right left',
              scrub: true
            }
          });
        gsap.from(item.querySelector('figcaption'), {
          autoAlpha: 0, y: 20, duration: .6,
          scrollTrigger: { trigger: item, containerAnimation: tween, start: 'left 88%' }
        });
      });

      return function () { tween.kill(); };
    });

    // mobile: simple stagger reveal on the scrollable row
    mm.add('(max-width: 900px)', function () {
      gsap.from('.gal__item', {
        y: 50, autoAlpha: 0, duration: .8, stagger: .06, ease: 'power3.out',
        scrollTrigger: { trigger: '.gal', start: 'top 80%' }
      });
    });
  }

  /* ---------------------------------------------------------
     8. CURSOR + MAGNETIC BUTTONS
     --------------------------------------------------------- */
  function cursorSystem() {
    if (REDUCED || window.matchMedia('(pointer: coarse)').matches) return;

    var cur   = $('#cursor');
    var dot   = $('.cursor__dot');
    var ring  = $('.cursor__ring');
    var label = $('.cursor__label');

    var xTo = gsap.quickTo(dot,  'x', { duration: .12, ease: 'power3' });
    var yTo = gsap.quickTo(dot,  'y', { duration: .12, ease: 'power3' });
    var rX  = gsap.quickTo(ring, 'x', { duration: .5,  ease: 'power3' });
    var rY  = gsap.quickTo(ring, 'y', { duration: .5,  ease: 'power3' });
    var lX  = gsap.quickTo(label,'x', { duration: .5,  ease: 'power3' });
    var lY  = gsap.quickTo(label,'y', { duration: .5,  ease: 'power3' });

    window.addEventListener('mousemove', function (e) {
      gsap.to(cur, { autoAlpha: 1, duration: .3, overwrite: 'auto' });
      xTo(e.clientX); yTo(e.clientY);
      rX(e.clientX);  rY(e.clientY);
      lX(e.clientX);  lY(e.clientY);
    });
    window.addEventListener('mouseleave', function () {
      gsap.to(cur, { autoAlpha: 0, duration: .3 });
    });

    $$('[data-cursor]').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        label.textContent = el.dataset.cursor;
        gsap.to(ring, { scale: 2.1, backgroundColor: 'rgba(193,102,63,.92)', borderColor: 'transparent', duration: .4, ease: 'power3.out' });
        gsap.to(dot,  { scale: 0, duration: .3 });
        gsap.to(label,{ autoAlpha: 1, duration: .3 });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(ring, { scale: 1, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(193,102,63,.5)', duration: .4, ease: 'power3.out' });
        gsap.to(dot,  { scale: 1, duration: .3 });
        gsap.to(label,{ autoAlpha: 0, duration: .2 });
      });
    });

    // magnetic pull
    $$('.magnetic').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      var my = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * .32);
        my((e.clientY - (r.top + r.height / 2)) * .42);
      });
      el.addEventListener('mouseleave', function () { mx(0); my(0); });
    });

    // 3D tilt on collection cards
    $$('[data-card]').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: .6, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: .6, ease: 'power3' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        ry(((e.clientX - (r.left + r.width / 2)) / r.width) * 13);
        rx(-((e.clientY - (r.top + r.height / 2)) / r.height) * 13);
      });
      card.addEventListener('mouseleave', function () { rx(0); ry(0); });
    });
  }

  /* ---------------------------------------------------------
     9. UI BEHAVIOUR
     --------------------------------------------------------- */
  function ui() {
    // anchor links
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var el = $(id);
        if (!el) return;
        e.preventDefault();
        if (drawerOpen) toggleDrawer(false);
        scrollTo(id);
      });
    });

    // ticker dismiss
    var tickerClose = $('#tickerClose');
    if (tickerClose) {
      tickerClose.addEventListener('click', function () {
        gsap.to('#ticker', {
          height: 0, duration: .5, ease: 'power3.inOut',
          onComplete: function () { $('#ticker').remove(); ScrollTrigger.refresh(); }
        });
      });
    }

    // drawer
    var drawer = $('#drawer'), burger = $('#burger'), nav = $('#nav');
    var drawerOpen = false;
    var dTl = gsap.timeline({ paused: true })
      .to(drawer, { clipPath: 'inset(0% 0% 0% 0%)', duration: .8, ease: 'expo.inOut' })
      .from('.drawer__nav a', { yPercent: 110, autoAlpha: 0, duration: .7, stagger: .06, ease: 'power4.out' }, '-=.4')
      .from('.drawer__foot', { autoAlpha: 0, y: 20, duration: .5 }, '-=.4');

    function toggleDrawer(open) {
      drawerOpen = open;
      drawer.classList.toggle('is-open', open);
      nav.classList.toggle('menu-open', open);
      if (open) { dTl.play(); if (lenis) lenis.stop(); }
      else { dTl.reverse(); if (lenis) lenis.start(); }
    }
    if (burger) burger.addEventListener('click', function () { toggleDrawer(!drawerOpen); });
    window.toggleDrawer = toggleDrawer;

    // newsletter (front-end only — hook up to a real service later)
    var form = $('#newsForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input');
        var btn = form.querySelector('button');
        if (!input.value || input.value.indexOf('@') < 0) {
          gsap.fromTo(form, { x: -9 }, { x: 0, duration: .55, ease: 'elastic.out(1,0.3)' });
          return;
        }
        form.classList.add('is-done');
        gsap.timeline()
          .to(input, { autoAlpha: 0, duration: .3 })
          .to(btn, { scale: .94, duration: .15 })
          .add(function () { btn.textContent = 'Welcome to the studio'; })
          .to(btn, { scale: 1, duration: .4, ease: 'back.out(2)' });
      });
    }

    // cart bounce
    $$('.prod__add').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var badge = $('.icnbtn--cart i');
        badge.textContent = +badge.textContent + 1;
        gsap.fromTo(badge, { scale: 1 }, { scale: 1.7, duration: .22, yoyo: true, repeat: 1, ease: 'power2.out' });
        gsap.fromTo(btn, { scale: 1 }, { scale: .93, duration: .12, yoyo: true, repeat: 1 });
      });
    });
  }

  /* ---------------------------------------------------------
     10. BOOT
     --------------------------------------------------------- */
  function boot() {
    // pre-split hero lede so the intro timeline can animate it
    var lede = $('.hero__lede[data-split-words]');
    if (lede) splitWords(lede);

    ui();
    cursorSystem();
    scrollSystem();
    horizontalGallery();

    ScrollTrigger.refresh();

    buildLoader(function () {
      var intro = heroIntro();
      ScrollTrigger.refresh();
      // ambient loops start only once the intro has settled, so they can never
      // compete with the intro tweens for the same properties
      if (intro) intro.eventCallback('onComplete', ambient);
      else ambient();
    });
  }

  // wait for fonts + images so measurements are correct
  var ready = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (res) {
      if (document.readyState === 'complete') return res();
      window.addEventListener('load', res);
    })
  ]);

  // hard timeout so the loader can never trap the page
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 4000); })]).then(function () {
    try {
      boot();
    } catch (err) {
      // never leave the site stuck behind the loader because of a motion bug
      console.error('[dreamcraft] boot failed:', err);
      var l = $('#loader');
      if (l) l.style.display = 'none';
      document.body.classList.remove('is-loading');
    }
  });

})();
