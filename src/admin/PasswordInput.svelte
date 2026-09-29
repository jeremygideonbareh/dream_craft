<script lang="ts">
  /* A password box with an eye button that shows what has been typed. */
  import { tick } from 'svelte';

  interface Props { value: string; autocomplete: string; minlength?: number }
  let { value = $bindable(), autocomplete, minlength }: Props = $props();
  let shown = $state(false);
  let input: HTMLInputElement;

  // Chrome moves the cursor to the start a frame after the box switches
  // between text and password, so put it back where it was after that
  async function toggle() {
    const from = input.selectionStart, to = input.selectionEnd;
    shown = !shown;
    await tick();
    requestAnimationFrame(() => {
      if (document.activeElement === input && from !== null) input.setSelectionRange(from, to);
    });
  }
</script>

<div class="pw">
  <input
    bind:this={input}
    type={shown ? 'text' : 'password'}
    {value}
    oninput={(e) => (value = e.currentTarget.value)}
    {autocomplete}
    {minlength}
    required
    autocapitalize="off"
    spellcheck="false"
  />
  <!-- pointerdown is cancelled so the cursor stays in the box while toggling -->
  <button
    type="button"
    class="pw__eye"
    onpointerdown={(e) => e.preventDefault()}
    onclick={toggle}
    aria-label={shown ? 'Hide password' : 'Show password'}
    aria-pressed={shown}
    title={shown ? 'Hide password' : 'Show password'}
  >
    {#if shown}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.2 6.2C4.2 7.6 2.7 9.6 2 12c1 2.5 5 7 10 7 1.9 0 3.6-.6 5.1-1.5" /></svg>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
    {/if}
  </button>
</div>
