# mynséra (formerly Dream Craft)

Website for **Mynséra**, a studio in Shillong, Meghalaya, making custom wedding invitations, florals and
personalised pieces. Its main job is to collect and qualify custom enquiries: customers browse, press
**Get a quote**, upload inspiration, choose their requirements and see an approximate price. The studio
then receives one complete enquiry.

## Stack

| | |
|---|---|
| Site | [Astro](https://astro.build) 7, static output (`dist/`) |
| Motion | GSAP 3.15 (ScrollTrigger, SplitText, Flip) + Lenis, installed from npm, no CDN |
| Backend | Supabase: Postgres (`enquiries`, `site_content`, `staff_members`), private `references` bucket, public `site-media` bucket |
| Admin | `/admin`, built with Svelte 5, for enquiries and all site content ([docs/admin-panel.md](docs/admin-panel.md)) |
| Type | Fraunces (display + wordmark), Jost (UI) |

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # -> dist/
npm run preview   # serve the build
```

To build for a GitHub Pages project URL instead of a custom domain:
`BASE_PATH=/dream_craft/ SITE_URL=https://<user>.github.io npm run build`.

## Where things live

```
src/content/defaults.ts  every editable word, image and price (seeds the database, fills gaps)
src/content/load.ts      build-time loader for published content
src/data/backend.ts      Supabase URL + publishable key (public by design)
src/lib/pricing.ts       the estimate formula, driven by the pricing document
src/admin/               the studio panel (Svelte)
src/pages/               index, work, pricing, quote, admin
src/scripts/motion/      core (GSAP/Lenis setup), main (site chrome), reveals (data-attribute motion), per-page files
src/scripts/quote.ts     the quote wizard
supabase/migrations/     database schema, roles, storage rules, submit_enquiry(), publishing
```

### Motion system

Every page gets motion from `data-` attributes handled in `src/scripts/motion/reveals.ts`
(`data-split`, `data-reveal`, `data-img-reveal`, `data-scrub-text`, `data-count`, `data-parallax`, …),
so new sections animate without new JavaScript. Page-specific motion (the hero intro, stacking cards,
the pinned gallery, the Flip filter) is registered through `registerPage()`.

- Smooth scrolling (Lenis), the custom cursor and hover tilt only run for mouse or trackpad users.
  Phones, including Instagram's in-app browser, keep native scrolling.
- `prefers-reduced-motion` is respected: everything renders in its final state and the gallery becomes
  a swipeable row. Add `?motion=on` to preview full motion on a machine that has reduced motion
  switched on (Windows: Settings → Accessibility → Visual effects → Animation effects), or `?motion=off`
  to preview the reduced version.
- The preloader shows once per session, never on `/quote`, and never for longer than 3 seconds. If the
  JavaScript bundle fails to load, a script in `<head>` reveals the page after 4.5 seconds.

## Content

Nothing on the public pages is hard-coded any more. Each area (settings, home,
work, pricing, quote, products, gallery) is a JSON document in `site_content`
with a **draft** and a **published** version. The build reads the published
ones; `src/content/defaults.ts` is the seed and the fallback for any field a
document doesn't have yet.

```bash
npm run build                          # published content; fails loudly if Supabase is unreachable
CONTENT_SOURCE=draft npm run build     # preview unpublished drafts (needs SUPABASE_SECRET_KEY)
CONTENT_SOURCE=defaults npm run build  # offline, ignores the database
node scripts/seed-content.mjs          # regenerate supabase/seed-content.sql from defaults
```

A failed build is deliberate: the host keeps the previous deploy live rather
than publishing a site with missing content.

## Enquiries (Supabase)

- The website can only **upload images** into `references/incoming/<session>/…` and **call
  `submit_enquiry(payload)`**. It cannot read, list, change or delete anything; this has been tested.
- `submit_enquiry` validates every field, rejects bad products, phones and emails, drops any image path
  that wasn't actually uploaded, silently ignores bots that fill the hidden field, and allows at most
  5 enquiries per phone number per 24 hours.
- Each enquiry gets a reference such as `MYN-1001` and a `status`
  (`new → reviewing → quoted → confirmed → in_production → dispatched → completed`, or `lost` / `spam`),
  so it can grow into a CRM, quotation or payment flow without a rebuild.
- **Reviewing enquiries:** the studio panel at `/admin`. Staff see the images, requirements and contact
  details, set a status, add internal notes and a quoted amount, and reply on WhatsApp in one tap.

To apply the schema to a fresh project, run `supabase/migrations/*.sql` in the SQL editor.

## Open items before launch

- [ ] Confirm the brand spelling and casing (the site uses *mynséra* as the wordmark, *Mynséra* in text)
- [ ] WhatsApp number (admin panel → Settings), so the hand-off after an enquiry is pre-filled
- [ ] Pricing assumptions to confirm (admin panel → Pricing): rush window (30 days) and range width (+35%)
- [ ] Full-resolution photos from the Instagram export (current images are 480 px and carry the old "Dream Craft" watermark)
- [ ] Domain in Mynséra's name, plus hosting (Cloudflare Pages or Netlify) on Mynséra's account
- [ ] Save the host's deploy hook so Publish rebuilds the site (see docs/admin-panel.md)
- [ ] Create the first admin login, then invite the rest of the team
- [ ] Email notifications: studio alert + customer confirmation (Resend + a Supabase Edge Function; needs the domain)
- [ ] Spam protection upgrade: Cloudflare Turnstile once hosting is chosen
