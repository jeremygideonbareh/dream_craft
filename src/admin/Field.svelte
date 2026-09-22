<script lang="ts">
  /* One editable field, chosen from the shape of the value.
     Objects and lists recurse, so a new piece of content in defaults.ts
     becomes editable here automatically. */
  import Self from './Field.svelte';
  import ImageField from './ImageField.svelte';
  import { app } from './store.svelte';

  interface Props { obj: any; k: string | number; label?: string; depth?: number }
  let { obj, k, label, depth = 0 }: Props = $props();

  const LONG = /lede|text|blurb|description|answer|note|hint|placeholder|consent|disclaimer|success|alt|tagline|start/i;
  const IMAGE = /^(image|cover|photo|logo)$/i;

  const value = $derived(obj[k]);
  const name = $derived(label ?? humanize(String(k)));

  function humanize(s: string) {
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
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
    (it && typeof it === 'object' && (it.title || it.name || it.question || it.label || it.value)) || `Item ${i + 1}`;
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
        {#if item && typeof item === 'object' && !Array.isArray(item)}
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
