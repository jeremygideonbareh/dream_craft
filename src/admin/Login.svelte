<script lang="ts">
  import { signIn, signUp, resetPassword, toast, brandParts } from './store.svelte';

  let mode = $state<'in' | 'up' | 'reset'>('in');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let msg = $state('');

  async function go() {
    msg = '';
    busy = true;
    if (mode === 'reset') {
      const { error } = await resetPassword(email);
      msg = error ? error.message : 'Check your email for a link to set a new password.';
    } else if (mode === 'up') {
      const { error } = await signUp(email, password);
      msg = error ? error.message : 'Almost there: confirm your email address, then sign in.';
    } else {
      const { error } = await signIn(email, password);
      if (error) msg = error.message;
    }
    busy = false;
  }
</script>

<div class="login">
  <div class="login__box">
    <p class="login__brand">{brandParts().before}<span>{brandParts().letter}</span>{brandParts().after}</p>
    <h1>{mode === 'up' ? 'Create your login' : mode === 'reset' ? 'Reset your password' : 'Studio sign in'}</h1>

    <form onsubmit={(e) => { e.preventDefault(); go(); }}>
      <label class="f"><span>Email</span><input type="email" bind:value={email} required autocomplete="email" /></label>
      {#if mode !== 'reset'}
        <label class="f">
          <span>Password</span>
          <input type="password" bind:value={password} required minlength="8" autocomplete={mode === 'up' ? 'new-password' : 'current-password'} />
        </label>
      {/if}
      <button class="btn btn--go" type="submit" disabled={busy}>
        {busy ? 'Working…' : mode === 'up' ? 'Create login' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
      </button>
    </form>

    {#if msg}<p class="login__msg">{msg}</p>{/if}

    <div class="login__links">
      {#if mode === 'in'}
        <button onclick={() => (mode = 'up')}>I was invited, create my login</button>
        <button onclick={() => (mode = 'reset')}>Forgot password</button>
      {:else}
        <button onclick={() => (mode = 'in')}>Back to sign in</button>
      {/if}
    </div>
  </div>
</div>
