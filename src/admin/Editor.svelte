<script lang="ts">
  /* Edits one content document: save the draft, publish it, restore a version. */
  import Field from './Field.svelte';
  import { app, saveDoc, publish, versions, restore, canEdit, uploadMedia, toast, defaults, type Role } from './store.svelte';
  import type { DocKey } from '../content/defaults';

  interface Props { docKey: DocKey; title: string; hint?: string }
  let { docKey, title, hint }: Props = $props();

  let saving = $state(false);
  let history = $state<{ id: number; saved_at: string; note: string | null }[]>([]);
  let showHistory = $state(false);
  let adding = $state(false);

  const doc = $derived(app.docs[docKey]);
  const dirty = $derived(doc && JSON.stringify(doc.draft) !== JSON.stringify(doc.published));
  const editable = $derived(canEdit(docKey));

  async function save() {
    saving = true;
    if (await saveDoc(docKey)) toast('Draft saved');
    saving = false;
  }
  async function saveAndPublish() {
    saving = true;
    if (await saveDoc(docKey)) await publish([docKey]);
    saving = false;
  }
  async function openHistory() {
    history = await versions(docKey) as any;
    showHistory = !showHistory;
  }
  function resetToDefaults() {
    if (!confirm(`Reset ${title} to the original wording? This only changes the draft.`)) return;
    doc.draft = structuredClone(defaults[docKey]);
    toast('Reset to the original. Save to keep it.');
  }

  // bulk photo upload for the gallery
  async function addPhotos(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (!files.length) return;
    adding = true;
    for (const f of files) {
      const url = await uploadMedia(f);
      if (!url) continue;
      doc.draft = [
        ...doc.draft,
        { id: crypto.randomUUID().slice(0, 8), visible: true, image: url, product: (app.docs.products?.draft?.[0]?.id ?? ''), title: f.name.replace(/\.[^.]+$/, ''), alt: '' },
      ];
    }
    adding = false;
    toast(`${files.length} photo(s) added. Remember to save.`);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<header class="screen__head">
  <div>
    <h2>{title}</h2>
    {#if hint}<p class="muted">{hint}</p>{/if}
  </div>
  <div class="screen__tools">
    {#if docKey === 'gallery' && editable}
      <label class="btn btn--sm">
        <input type="file" accept="image/*" multiple onchange={addPhotos} hidden />
        {adding ? 'Uploading…' : '+ Add photos'}
      </label>
    {/if}
    <button class="btn btn--sm btn--ghost" onclick={openHistory}>History</button>
    {#if editable}
      <button class="btn btn--sm btn--ghost" onclick={resetToDefaults}>Reset</button>
      <button class="btn btn--sm" onclick={save} disabled={saving}>Save draft</button>
      <button class="btn btn--sm btn--go" onclick={saveAndPublish} disabled={saving}>Save &amp; publish</button>
    {/if}
  </div>
</header>

{#if !editable}
  <p class="notice">You can look at this, but only an admin can change it.</p>
{:else if dirty}
  <p class="notice notice--warn">This section has unpublished changes.</p>
{/if}

{#if showHistory}
  <div class="history">
    <h4>Earlier versions</h4>
    {#if !history.length}
      <p class="muted">Nothing published yet, so there is no history.</p>
    {:else}
      <ul>
        {#each history as v}
          <li>
            <span>{new Date(v.saved_at).toLocaleString('en-IN')}</span>
            <button class="btn btn--sm btn--ghost" onclick={() => restore(v.id)} disabled={!editable}>Restore</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

{#if doc}
  <div class="fields" class:is-locked={!editable}>
    <Field obj={doc} k="draft" label={title} />
  </div>
{/if}
