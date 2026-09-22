# Studio panel (/admin)

Everything on the website is edited here. The public pages are still static
files, so visitors get a fast site; pressing **Publish** rebuilds them.

## Two levels of access

| | Staff | Admin |
|---|---|---|
| Enquiries: read, images, status, notes, quoted price, WhatsApp / call / email | ✅ | ✅ |
| Products and gallery photos: add, edit, reorder, hide, publish | ✅ | ✅ |
| Home, work, pricing and quote-form wording; brand and contact settings | — | ✅ |
| Team: invite people, change roles, switch access off | — | ✅ |
| Delete an enquiry | — | ✅ |

The database enforces this, not just the screens. A staff login that tried to
change pricing directly would be refused by Postgres.

## Adding someone

1. An admin opens **Team**, enters their email and picks Staff or Admin.
2. That person goes to `/admin`, chooses *I was invited, create my login*, and
   signs up **with the same email address**.
3. They confirm the email, which proves the mailbox is theirs, and the role is
   applied automatically.

To remove someone, switch their access off in **Team**. Their login stays but
opens to "No access".

## The first admin

Only an existing admin can invite. To create the very first one, add a row by
hand in the Supabase dashboard:

```sql
insert into public.staff_invites (email, role, name)
values ('owner@example.com', 'admin', 'Owner');
```

Then sign up at `/admin` with that address.

## Editing and publishing

- Every screen edits a **draft**. The website does not change until someone
  presses **Publish**.
- **Save draft** keeps your work. **Save & publish** does both.
- The bar at the top shows which sections have unpublished changes.
- **History** lists earlier published versions, and **Restore** puts one back
  into the draft, ready to review and publish again.
- **Reset** returns a section to the wording the site shipped with.
- If two people edit the same section, the second save is refused with a
  warning rather than overwriting the first.

Images: **Change** on any image lets you upload a photo (resized on your device
first), reuse an earlier upload, or pick one of the photos the site shipped with.

## Making Publish rebuild the site

Once hosting is set up, save the host's deploy hook URL once:

```sql
insert into public.app_config (key, value)
values ('deploy_hook_url', 'https://api.cloudflare.com/…deploy-hook…')
on conflict (key) do update set value = excluded.value;
```

After that, every Publish tells the host to rebuild, and the new content is live
in a minute or two. Until then, Publish records the change and the site updates
on the next build.

## What can and cannot be changed here

Changeable: every word, image, price, package, product, gallery photo, FAQ,
colour swatch, budget range, announcement bar, contact details, and which home
page sections appear and in what order.

Not changeable here: page layouts and animations. Those live in the code, so a
wrong click can't break the design.
