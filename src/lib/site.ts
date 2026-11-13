import type { Content } from '../content/defaults';

type Contact = Content['settings']['contact'];

// A plain number lets the post-enquiry hand-off pre-fill the message;
// wa.me/message/... short links can't carry text.
export function whatsappLink(c: Contact, text?: string) {
  const n = c.whatsappNumber.replace(/\D/g, '');
  if (n) return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  return c.whatsappLink;
}

// Fill {placeholders} in wording edited in the admin panel, e.g.
// fill('for {qty} invites', { qty: 50 }). Unknown placeholders are left as typed.
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

// the WhatsApp logo, as one SVG path
export const WHATSAPP_ICON =
  'M12 2.2a9.8 9.8 0 0 0-8.5 14.7L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.6 4.2 3.7 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.6-.4Z';
