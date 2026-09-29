<script lang="ts">
  /* Shown after an invite or password-reset link: choose the password for this login. */
  import { app, setPassword, toast, brandParts } from './store.svelte';
  import PasswordInput from './PasswordInput.svelte';

  let password = $state('');
  let again = $state('');
  let busy = $state(false);
  let msg = $state('');

  async function go() {
    msg = '';
    if (password !== again) { msg = "The two passwords don't match."; return; }
    busy = true;
    const { error } = await setPassword(password);
    busy = false;
    if (error) msg = error.message;
    else toast('Password saved. Use it to sign in from now on.');
  }
</script>

<div class="login">
  <div class="login__box">
    <p class="login__brand">{brandParts().before}<span>{brandParts().letter}</span>{brandParts().after}</p>
    <h1>Choose your password</h1>
    <p>For {app.session?.user.email}. At least 8 characters.</p>

    <form onsubmit={(e) => { e.preventDefault(); go(); }}>
      <label class="f">
        <span>New password</span>
        <PasswordInput bind:value={password} minlength={8} autocomplete="new-password" />
      </label>
      <label class="f">
        <span>Type it again</span>
        <PasswordInput bind:value={again} minlength={8} autocomplete="new-password" />
      </label>
      <button class="btn btn--go" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>

    {#if msg}<p class="login__msg">{msg}</p>{/if}
  </div>
</div>
