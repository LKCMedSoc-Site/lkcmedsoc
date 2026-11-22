-- Group accounts may sign in: every address in a body's contact email (Records) is on the sign-up list.
-- The shared sign-in (shared/signin.js, used by the website header and every app) now has "Continue with Google" for the
-- shared Gmail accounts of student groups, committees, houses and years. A new account (email or Google) is only created if
-- records.email_allowed() says yes (trigger records_check_signup on auth.users). Until now that list held students, admins,
-- group managers and a manual allowlist, so many group contact emails (most committees, ExCo, several projects) were refused.
-- records.bodies.contact_email can hold several addresses separated by commas (e.g. a committee's Gmail and its NTU address).
-- Personal Gmails stay refused.

create or replace function records.email_allowed(e text)
returns boolean
language sql
stable security definer
set search_path to 'records', 'public'
as $function$
  select exists (select 1 from students  where lower(email) = lower(trim(e)) and status in ('Active', 'LOA'))
      or exists (select 1 from signin_allowlist a
                 where a.entry = lower(trim(e)) or a.entry = '@' || split_part(lower(trim(e)), '@', 2))
      or exists (select 1 from admins     where lower(email) = lower(trim(e)))
      or exists (select 1 from body_managers where lower(email) = lower(trim(e)))
      or exists (select 1 from bodies b, unnest(string_to_array(coalesce(b.contact_email, ''), ',')) x
                 where trim(x) <> '' and lower(trim(x)) = lower(trim(e)))
$function$;
