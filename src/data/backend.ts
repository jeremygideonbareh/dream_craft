// Supabase project owned by the Mynsera account.
// The publishable key is designed to be public: it can only do what the
// database's row-level security allows (upload reference images, call
// submit_enquiry). Never put the secret / service_role key in this repo.
export const backend = {
  url: import.meta.env.PUBLIC_SUPABASE_URL || 'https://ttgkrrqzmrlublrbhxex.supabase.co',
  key: import.meta.env.PUBLIC_SUPABASE_KEY || 'sb_publishable_dkmJBFswoa6uN1DjbASFpg_eCsR4YJ4',
  bucket: 'references',
  maxFiles: 5,
  maxBytes: 10 * 1024 * 1024,
};
