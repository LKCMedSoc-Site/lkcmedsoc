// Same Supabase project as the records and Gazette sites. The publishable key is meant to be public:
// access is controlled by the database rules, not by hiding this key.
window.PORTAL_CONFIG = {
  SUPABASE_URL: 'https://brwdgbitxisadwbuwbdi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_iVGn5p_HufuRZYEiAP_IyA_qxizqqfM',
  SITE_URL: 'https://lkcmedsoc.com',   // where the public Policy pages (and their PDFs) live
  ORG_NAME: 'LKCMedSoc'
};
// Local testing only: add ?mock to the address to use the stand-in database (cd site && npm run mock) and skip sign-in.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]mock\b/.test(location.search)) {
  window.PORTAL_CONFIG.SUPABASE_URL = 'http://localhost:54321';
  window.PORTAL_CONFIG.SITE_URL = 'http://localhost:3100';
  window.PORTAL_CONFIG.DEMO = true;
}
