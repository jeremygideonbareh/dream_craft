<script lang="ts">
  /* Pick an image: upload a new one, choose one already uploaded, or keep a
     bundled photo. Uploads are resized on the device first. */
  import { uploadMedia, listMedia, toast } from './store.svelte';

  interface Props { value: string; label: string }
  let { value = $bindable(), label }: Props = $props();

  let picking = $state(false);
  let busy = $state(false);
  let media = $state<string[]>([]);

  // previews for photos bundled with the site, embedded by the admin page
  const assets: Record<string, string> = JSON.parse(document.getElementById('assetPreviews')?.textContent || '{}');
  const preview = $derived(value.startsWith('asset:') ? assets[value.slice(6)] ?? '' : value);

  async function open() {
    picking = true;
    media = await listMedia();
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    const url = await uploadMedia(file);
    busy = false;
    if (url) { value = url; picking = false; toast('Image uploaded'); }
  }
</script>

<div class="f">
  <span>{label}</span>
  <div class="img">
    {#if value}
      {#if preview}
        <img src={preview} alt="" />
      {:else}
        <div class="img__asset" title={value}>Missing photo<br /><code>{value.slice(0, 24)}</code></div>
      {/if}
    {:else}
      <div class="img__empty">No image</div>
    {/if}
    <div class="img__tools">
      <button class="btn btn--sm" onclick={open}>Change</button>
      {#if value}<button class="btn btn--sm btn--ghost" onclick={() => (value = '')}>Remove</button>{/if}
    </div>
  </div>
</div>

{#if picking}
  <div class="modal" role="dialog" aria-label="Choose an image">
    <div class="modal__box">
      <div class="modal__head">
        <h3>Choose an image</h3>
        <button class="ico" onclick={() => (picking = false)}>×</button>
      </div>
      <label class="upload">
        <input type="file" accept="image/*" onchange={onFile} disabled={busy} />
        <span>{busy ? 'Uploading…' : 'Upload from this device'}</span>
      </label>
      {#if Object.keys(assets).length}
        <p class="modal__label">Photos that came with the site</p>
        <div class="modal__grid">
          {#each Object.entries(assets) as [file, src]}
            <button class="thumb" class:is-on={value === 'asset:' + file} onclick={() => { value = 'asset:' + file; picking = false; }}>
              <img src={src} alt="" loading="lazy" />
            </button>
          {/each}
        </div>
      {/if}
      {#if media.length}
        <p class="modal__label">Already uploaded</p>
        <div class="modal__grid">
          {#each media as m}
            <button class="thumb" class:is-on={m === value} onclick={() => { value = m; picking = false; }}>
              <img src={m} alt="" loading="lazy" />
            </button>
          {/each}
        </div>
      {:else}
        <p class="modal__label">Nothing uploaded yet.</p>
      {/if}
      <label class="f">
        <span>Or paste an image address</span>
        <input type="url" bind:value placeholder="https://…" />
      </label>
      <div class="modal__foot"><button class="btn" onclick={() => (picking = false)}>Done</button></div>
    </div>
  </div>
{/if}
