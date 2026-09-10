# Dream Craft

Marketing site for **Dream Craft** — a bespoke wedding & event stationery, florals and
personalised gift studio based in Shillong, Meghalaya.

Live: https://jeremygideonbareh.github.io/dream_craft/

## Stack

Static site — no build step, no dependencies to install.

| | |
|---|---|
| Markup | Single `index.html` |
| Styles | `css/style.css` (custom properties, no framework) |
| Motion | GSAP 3.12.5 + ScrollTrigger, Lenis smooth scroll (CDN) |
| Type | Fraunces (display), Jost (UI), Great Vibes (wordmark) |

## Running locally

Any static server works:

```bash
python -m http.server 4321
```

Then open `http://localhost:4321`.

## Motion overview

All motion lives in `js/main.js`, grouped into numbered sections:

1. **Smooth scroll** — Lenis driven by the GSAP ticker, wired into `ScrollTrigger.update`
2. **Text splitting** — hand-rolled line/word/char splitter (no paid GSAP plugins)
3. **Preloader** — SVG stroke draw, counter to 100, staggered panel curtain
4. **Hero intro** — masked line reveals, clip-path image wipe, light sweep, magnetic CTAs
5. **Ambient loops** — floating cards, drifting petals, running ticker
6. **Scroll system** — parallax, velocity-reactive marquee, per-section reveals, progress bar
7. **Pinned horizontal gallery** — desktop only, with per-tile `containerAnimation` drift
8. **Custom cursor** — magnetic buttons and 3D card tilt
9. **UI** — drawer, ticker dismiss, newsletter, cart counter

### Accessibility

The site fully respects `prefers-reduced-motion: reduce`. Under that setting the
preloader, intro timeline, ambient loops, parallax, custom cursor and the pinned
horizontal scroll are all skipped — the gallery falls back to a natively scrollable
row and every section renders in its final state.

## Content notes

- Photography is Dream Craft's own work, sourced from
  [@dreamcraft](https://www.instagram.com/dreamcraft) and stored in `assets/img/`.
- **Prices shown are placeholders** and are marked with a comment in `index.html`.
  Swap them for real pricing before launch.
- The newsletter form is front-end only — it needs to be connected to a real
  mailing-list provider.
- Stat figures in the hero (orders, years, countries) are illustrative.
