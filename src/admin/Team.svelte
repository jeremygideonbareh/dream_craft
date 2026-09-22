<script lang="ts">
  /* Admin only: invite staff, change roles, switch access off. */
  import { app, listTeam, invite, revokeInvite, setMember, toast, type Member, type Role } from './store.svelte';

  let members = $state<Member[]>([]);
  let invites = $state<{ email: string; role: Role; name: string | null }[]>([]);
  let email = $state('');
  let name = $state('');
  let role = $state<Role>('staff');
  let busy = $state(false);

  async function load() {
    const t = await listTeam();
    members = t.members;
    invites = t.invites as any;
  }
  load();

  async function add() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Enter a valid email address'); return; }
    busy = true;
    if (await invite(email, role, name)) { email = ''; name = ''; await load(); }
    busy = false;
  }
  async function change(m: Member, patch: Partial<Member>) {
    if (m.user_id === app.session?.user.id) {
      toast('You cannot change your own access.');
      await load();   // put the dropdown back to what it really is
      return;
    }
    if (await setMember(m.user_id, patch)) await load();
  }
</script>

<header class="screen__head">
  <div>
    <h2>Team</h2>
    <p class="muted">Staff can work on enquiries, products and gallery photos. Admins can change everything.</p>
  </div>
</header>

<div class="card">
  <h4>Invite someone</h4>
  <div class="invite">
    <input placeholder="Email address" bind:value={email} />
    <input placeholder="Name (optional)" bind:value={name} />
    <select bind:value={role}><option value="staff">Staff</option><option value="admin">Admin</option></select>
    <button class="btn btn--sm btn--go" onclick={add} disabled={busy}>Invite</button>
  </div>
  <p class="muted">They get access by signing up at this page with that email address and confirming it.</p>
</div>

{#if invites.length}
  <div class="card">
    <h4>Waiting to sign up</h4>
    <ul class="rows">
      {#each invites as i}
        <li class="row row--plain">
          <span>{i.email} · {i.role}</span>
          <button class="btn btn--sm btn--ghost" onclick={async () => { await revokeInvite(i.email); load(); }}>Cancel</button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<div class="card">
  <h4>People with access</h4>
  <ul class="rows">
    {#each members as m}
      <li class="row row--plain" class:is-off={!m.active}>
        <span>
          <b>{m.name || m.email}</b>
          <small class="muted">{m.email}{m.user_id === app.session?.user.id ? ' · you' : ''}</small>
        </span>
        <span class="row__tools">
          <select value={m.role} onchange={(e) => change(m, { role: (e.target as HTMLSelectElement).value as Role })}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button class="btn btn--sm btn--ghost" onclick={() => change(m, { active: !m.active })}>
            {m.active ? 'Switch off' : 'Switch on'}
          </button>
        </span>
      </li>
    {/each}
  </ul>
</div>
