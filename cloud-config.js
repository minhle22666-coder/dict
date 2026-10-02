/* Supabase project for the cloud save (cloud.js).

   Fill these two from the Supabase dashboard: Project Settings > API >
   "Project URL" and the "anon public" key. The anon key is meant to be
   public -- what protects each person's data is the row-level security
   policy in supabase/setup.sql (a signed-in user can only read and write
   their own row). Never put the service_role key here.

   Left empty, the app works exactly as before, offline, and the account
   sheet says the cloud save is not set up yet. */
window.FC_CLOUD = {
  url: '',
  anonKey: ''
};
