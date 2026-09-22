<script lang="ts">
  /* Admin panel shell: sign in, choose a screen, publish changes. */
  import Login from './Login.svelte';
  import Enquiries from './Enquiries.svelte';
  import Editor from './Editor.svelte';
  import Team from './Team.svelte';
  import { app, initSession, signOut, isAdmin, unpublished, unsaved, publish } from './store.svelte';
  import type { DocKey } from '../content/defaults';

  type Screen = { id: string; label: string; doc?: DocKey; title?: string; hint?: string; admin?: boolean };

  const SCREENS: Screen[] = [
    { id: 'enquiries', label: 'Enquiries' },
    { id: 'products', label: 'Products', doc: 'products', title: 'Products', hint: 'What the studio makes. These appear on the home page, the work filter and the quote form.' },
    { id: 'gallery', label: 'Gallery', doc: 'gallery', title: 'Gallery photos', hint: 'Photos of your work. Each one links to a quote for that product.' },
    { id: 'home', label: 'Home page', doc: 'home', title: 'Home page', hint: 'Every word on the home page. The "Sections" list sets the order, and removing one hides that section.', admin: true },
    { id: 'work', label: 'Work page', doc: 'work', title: 'Work page', admin: true },
    { id: 'pricing', label: 'Pricing', doc: 'pricing', title: 'Packages & pricing', hint: 'Package prices, add-on rules and the questions shown on the pricing page. The quote estimate uses these numbers.', admin: true },
    { id: 'quotepage', label: 'Quote form', doc: 'quote', title: 'Quote form wording', hint: 'Step headings, budget ranges, occasions, colours and the thank-you screen.', admin: true },
    { id: 'settings', label: 'Settings', doc: 'settings', title: 'Brand & contact', hint: 'Name, tagline, WhatsApp number, Instagram, the announcement bar and the footer.', admin: true },
    { id: 'team', label: 'Team', admin: true },
  ];

  let screen = $state('enquiries');
  let publishing = $state(false);
  const visible = $derived(SCREENS.filter((s) => !s.admin || isAdmin()));
  const current = $derived(visible.find((s) => s.id === screen) ?? visible[0]);
  const pending = $derived(unpublished());

  initSession();

  // don't let a stray refresh throw away typing that hasn't been saved
  $effect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (unsaved().length) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });

  async function publishAll() {
    if (!pending.length) return;
    publishing = true;
    await publish(pending);
    publishing = false;
  }
</script>

{#if app.loading || app.checking}
  <p class="boot">Loading…</p>
{:else if !app.session}
  <Login />
{:else if !app.me || !app.me.active}
  <div class="login">
    <div class="login__box">
      <h1>No access</h1>
      <p>This login isn't set up for the studio panel{app.me && !app.me.active ? ' any more' : ''}. Ask an admin to invite {app.session.user.email}.</p>
      <button class="btn" onclick={signOut}>Sign out</button>
    </div>
  </div>
{:else}
  <div class="shell">
    <aside class="side">
      <p class="side__brand"><span class="side__name">myns<span>é</span>ra</span><small>studio panel</small></p>
      <nav>
        {#each visible as s}
          <button class="side__link" class:is-on={current.id === s.id} onclick={() => (screen = s.id)}>{s.label}</button>
        {/each}
      </nav>
      <div class="side__me">
        <b>{app.me.name || app.me.email}</b>
        <small>{app.me.role === 'admin' ? 'Admin' : 'Staff'}</small>
        <button class="btn btn--sm btn--ghost" onclick={signOut}>Sign out</button>
      </div>
    </aside>

    <main class="screen">
      {#if unsaved().length}
        <div class="publish publish--unsaved">
          <span>You have changes that aren't saved yet: {unsaved().join(', ')}</span>
        </div>
      {/if}
      {#if pending.length}
        <div class="publish">
          <span><b>{pending.length}</b> section{pending.length > 1 ? 's' : ''} with unpublished changes: {pending.join(', ')}</span>
          <button class="btn btn--sm btn--go" onclick={publishAll} disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish to the website'}
          </button>
        </div>
      {/if}

      {#if current.id === 'enquiries'}
        <Enquiries />
      {:else if current.id === 'team'}
        <Team />
      {:else if current.doc}
        {#key current.doc}
          <Editor docKey={current.doc} title={current.title ?? current.label} hint={current.hint} />
        {/key}
      {/if}
    </main>
  </div>

  {#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
{/if}
