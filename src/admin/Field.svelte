<script lang="ts">
  /* One editable field, chosen from the shape of the value.
     Objects and lists recurse, so a new piece of content in defaults.ts
     becomes editable here automatically. */
  import Self from './Field.svelte';
  import ImageField from './ImageField.svelte';
  import { app } from './store.svelte';

  interface Props { obj: any; k: string | number; label?: string; depth?: number }
  let { obj, k, label, depth = 0 }: Props = $props();

  const LONG = /lede|text|blurb|description|answer|note|hint|placeholder|consent|disclaimer|success|alt|tagline|start|message|errors?$/i;
  const IMAGE = /^(image|cover|photo|logo)$/i;
  const IMAGE_LIST = /^(images|photos)$/i;   // a list whose items are each one image

  const value = $derived(obj[k]);
  const name = $derived(label ?? humanize(String(k)));

  // friendlier names for the handful of keys whose code name isn't obvious
  const NAMES: Record<string, string> = {
    lede: 'Intro paragraph', eyebrow: 'Small label above the heading',
    titleAccent: 'Heading, highlighted words', titleEnd: 'Heading, last words',
    line1: 'Headline line 1', line2: 'Headline line 2 (highlighted)', line3: 'Headline line 3',
    cta: 'Closing call to action', sub: 'Line under the heading', blurb: 'Short description',
    short: 'Short name', alt: 'Description for screen readers', imageAlt: 'Description for screen readers',
    trust: 'Small facts under the buttons', sections: 'Sections, in order',
    estimate: 'Show a price estimate for this', defaultQty: 'Quantity to start from',
    unit: 'What the quantity counts', note: 'Small note', value: 'Saved value (not shown to customers)',
    visible: 'Show on the website', hex: 'Colour', from: 'Starting price (₹)', qty: 'Number of invites',
    featured: 'Highlight this package', primaryButton: 'Main button', secondaryButton: 'Second button',
    whatsappLabel: 'WhatsApp link text', itemHint: 'Text under each photo',
    ticker: 'Announcement bar messages', madeIn: 'Line in the footer bar',
    startTitle: 'Footer heading', startText: 'Footer paragraph',
    showFormerly: 'Show "formerly Dream Craft"', rushWithinDays: 'Rush if the date is within (days)',
    rangeSpreadPercent: 'Estimate range width (%)', bulkDiscountAbove: 'Bulk discount above (pieces)',
    bulkDiscountPercent: 'Bulk discount (%)', customFromPerInvite: 'Custom invites from (₹ each)',
    foilNamesPerInvite: 'Foil names (₹ each)', foilFullPerInvite: 'Full-page foil (₹ each)',
    rushPerInvite: 'Rush order (₹ each)', nextSteps: 'What happens next (3 lines)',
    // menu, footer and other site-wide wording
    nav: 'Menu', ourWork: 'Our work link', whatWeMake: 'What we make link', howItWorks: 'How it works link',
    quoteButton: 'Get a quote button', skipToContent: 'Skip link (screen readers only)',
    formerlyLabel: 'Word before the old name', notFound: 'Page not found (mistyped links)',
    homeButton: 'Home button', workButton: 'Our work button',
    studioTitle: 'Studio column heading', pricingLink: 'Pricing link', privacyLink: 'Privacy link', termsLink: 'Terms link',
    makeTitle: 'Products column heading', helloTitle: 'Contact column heading', instagramLabel: 'Instagram link word',
    // home and work pages
    whatsappButton: 'WhatsApp button', whatsappMessage: 'Pre-written WhatsApp message', scrollLabel: 'Scroll hint',
    quoteLabel: 'Word on each card', madeToOrder: 'Line under products with no types', fullPricingLink: 'Link to the pricing page',
    allFilter: 'First filter button', quoteThis: 'Word on each photo', emptyButton: 'Button when a filter is empty',
    photosComingSoon: 'Label on products without photos',
    // pricing wording
    labels: 'Wording around the prices', starting: 'Word above each price', forQty: 'Line under each price',
    chipCustom: 'Home page: custom invites', chipFoilNames: 'Home page: foil names', chipFoilFull: 'Home page: full-page foil',
    chipRush: 'Home page: rush orders', chipBulk: 'Home page: bulk discount',
    ruleCustom: 'Pricing page: custom invites', ruleFoilNames: 'Pricing page: foil names', ruleFoilFull: 'Pricing page: full-page foil',
    ruleBulk: 'Pricing page: bulk discount', ruleRush: 'Pricing page: rush orders', bulkOff: 'Pricing page: discount figure',
    startQuote: 'Link to the quote form', estimateLines: 'Lines in the price estimate',
    // quote form
    stepNames: 'Step names (progress bar, 7 steps)', form: 'Form labels', choices: 'Detail choices',
    buttons: 'Buttons', review: 'Check & send step', errors: 'Messages when something is missing',
    // legal pages
    contactQuestion: 'Line at the end of both pages', contactWhatsapp: 'WhatsApp link text', contactOrEmail: 'Words before the email address',
  };

  function humanize(s: string) {
    if (NAMES[s]) return NAMES[s];
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());
  }

  const products = $derived((app.docs.products?.draft ?? []) as { id: string; title: string }[]);

  function blankFrom(item: any): any {
    if (Array.isArray(item)) return [];
    if (item && typeof item === 'object') {
      const out: any = {};
      for (const [key, v] of Object.entries(item)) {
        out[key] = key === 'id' ? crypto.randomUUID().slice(0, 8)
          : key === 'visible' ? true
          : /qty|quantity/i.test(key) ? 1
          : blankFrom(v);
      }
      return out;
    }
    if (typeof item === 'number') return 0;
    if (typeof item === 'boolean') return false;
    return '';
  }

  const addItem = () => obj[k] = [...value, value.length ? blankFrom(value[0]) : ''];
  const removeItem = (i: number) => obj[k] = value.filter((_: unknown, j: number) => j !== i);
  function move(i: number, d: number) {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    obj[k] = next;
  }
  const itemLabel = (it: any, i: number) =>
    (it && typeof it === 'object' && (it.title || it.name || it.question || it.label || it.value))
    || (IMAGE_LIST.test(String(k)) ? (i === 0 ? 'Main photo' : `Photo ${i + 1}`) : `Item ${i + 1}`);
</script>

{#if IMAGE.test(String(k)) && typeof value === 'string'}
  <ImageField bind:value={obj[k]} label={name} />

{:else if String(k) === 'hex'}
  <label class="f f--row">
    <span>{name}</span>
    <input type="color" bind:value={obj[k]} />
  </label>

{:else if String(k) === 'product' && typeof value === 'string'}
  <label class="f">
    <span>{name}</span>
    <select bind:value={obj[k]}>
      {#each products as p}<option value={p.id}>{p.title}</option>{/each}
    </select>
  </label>

{:else if typeof value === 'boolean'}
  <label class="f f--row">
    <span>{name}</span>
    <input type="checkbox" bind:checked={obj[k]} />
  </label>

{:else if typeof value === 'number'}
  <label class="f">
    <span>{name}</span>
    <input type="number" bind:value={obj[k]} />
  </label>

{:else if typeof value === 'string'}
  <label class="f">
    <span>{name}</span>
    {#if /\{\w+\}/.test(value)}<small class="f__hint">Words in {'{'}curly brackets{'}'} are filled in automatically: {value.match(/\{\w+\}/g)?.join(', ')}</small>{/if}
    {#if LONG.test(String(k)) || value.length > 90}
      <textarea rows={Math.min(6, Math.ceil(value.length / 70) + 1)} bind:value={obj[k]}></textarea>
    {:else}
      <input type="text" bind:value={obj[k]} readonly={String(k) === 'id' && depth > 0 && !!value} />
    {/if}
  </label>

{:else if Array.isArray(value)}
  <div class="grp">
    <div class="grp__head">
      <h4>{name} <em>{value.length}</em></h4>
      <button class="btn btn--sm" onclick={addItem}>+ Add</button>
    </div>
    {#each value as item, i (i)}
      <div class="item">
        <div class="item__bar">
          <b>{itemLabel(item, i)}</b>
          <div class="item__tools">
            <button class="ico" onclick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
            <button class="ico" onclick={() => move(i, 1)} disabled={i === value.length - 1} title="Move down">↓</button>
            <button class="ico ico--del" onclick={() => confirm('Remove this item?') && removeItem(i)} title="Remove">×</button>
          </div>
        </div>
        {#if IMAGE_LIST.test(String(k)) && typeof item === 'string'}
          <div class="item__body"><ImageField bind:value={obj[k][i]} label="Image" /></div>
        {:else if item && typeof item === 'object' && !Array.isArray(item)}
          <div class="item__body">
            {#each Object.keys(item) as key}
              <Self obj={item} k={key} depth={depth + 1} />
            {/each}
          </div>
        {:else}
          <div class="item__body"><Self obj={value} k={i} label={`Item ${i + 1}`} depth={depth + 1} /></div>
        {/if}
      </div>
    {/each}
  </div>

{:else if value && typeof value === 'object'}
  <fieldset class="sub">
    <legend>{name}</legend>
    {#each Object.keys(value) as key}
      <Self obj={value} k={key} depth={depth + 1} />
    {/each}
  </fieldset>
{/if}
