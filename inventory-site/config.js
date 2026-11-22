// Same Supabase project as the other LKCMedSoc apps. The publishable key is meant to be public:
// access is controlled by the database rules and the `api` function, not by hiding this key.
window.PORTAL_CONFIG = {
  SUPABASE_URL: 'https://brwdgbitxisadwbuwbdi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_iVGn5p_HufuRZYEiAP_IyA_qxizqqfM',
  ORG_NAME: 'LKCMedSoc',
  API_URL: 'https://brwdgbitxisadwbuwbdi.supabase.co/functions/v1/api',
  // Google sign-in is only for the shared Gmail accounts of student groups, committees, houses and years.
  // Everyone else signs in with their NTU email. The `api` function refuses any other Gmail.
  GOOGLE_CLIENT_ID: '670485583889-faa0hdrce3f9no59kivehagq4tvs8she.apps.googleusercontent.com'
};
