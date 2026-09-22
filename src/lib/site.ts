import type { Content } from '../content/defaults';

type Contact = Content['settings']['contact'];

// A plain number lets the post-enquiry hand-off pre-fill the message;
// wa.me/message/... short links can't carry text.
export function whatsappLink(c: Contact, text?: string) {
  const n = c.whatsappNumber.replace(/\D/g, '');
  if (n) return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  return c.whatsappLink;
}
