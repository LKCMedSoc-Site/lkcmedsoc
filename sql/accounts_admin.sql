-- People and Accounts (ExCo only): a table of every approved person, a panel to manage one person's record and account, student
-- types (Regular / Retainee / Exchange) with an end date, LOA and alumni.
-- Run once in the Supabase SQL editor (project: lkcmedsoc-inventory). Safe to run more than once.
-- Needs records.email_allowed(), records.me_email(), records.roster_view and activities.is_exco() (already there).
-- Every function checks activities.is_exco() itself, so the browser cannot call them as anyone else. Sending a reset email needs no function:
-- the Records site asks Supabase to email the code, the same as the person pressing "Forgot password".
--
-- Also fixes records.annual_sync: its backup step used "select now(), s.*", which stopped working when photo_url / show_photo were added to
-- students (the backup table has no such columns), so the sync failed. It now names its columns. And the sync leaves Exchange students alone.

-- ---------- columns ----------
alter table records.students add column if not exists kind text not null default 'Regular';
alter table records.students add column if not exists until date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_kind_check' and conrelid = 'records.students'::regclass) then
    alter table records.students add constraint students_kind_check check (kind in ('Regular', 'Retainee', 'Exchange'));
  end if;
end $$;
-- the backup copy keeps the same columns, in the same order, as before; the new ones come at the end
alter table records.students_backup add column if not exists photo_url text;
alter table records.students_backup add column if not exists show_photo boolean;
alter table records.students_backup add column if not exists kind text;
alter table records.students_backup add column if not exists until date;

-- who changed which student, and what it was before
create table if not exists records.student_changes (
  id bigserial primary key, at timestamptz not null default now(), by_email text, matric text not null, change jsonb not null
);
alter table records.student_changes enable row level security;   -- no policies: only the functions below can read or write it

-- ---------- functions ----------
-- true when the signed-in person may use the People tab
create or replace function records.accounts_ok() returns boolean
language sql stable security definer set search_path = records, public as $$
  select activities.is_exco()
$$;

-- Everyone approved to sign up (roster, admins, body managers, single emails on the sign-in list) joined to their account, if they made one,
-- plus any account whose email is not in those lists (shown as "not on the list", the ones to check or delete).
create or replace function records.accounts_list() returns jsonb
language plpgsql stable security definer set search_path = records, public as $$
declare r jsonb;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  with ppl as (
    select lower(trim(email)) e, 'student' src, full_name, preferred_name, matric, house, grad_year, status, kind, until
      from students where coalesce(email, '') <> ''
    union all select lower(trim(email)), 'admin', null, null, null, null, null::int, null, null, null::date from admins
    union all select lower(trim(email)), 'manager', null, null, null, null, null::int, null, null, null::date from body_managers
    union all select entry, 'list', null, null, null, null, null::int, null, null, null::date from signin_allowlist where entry like '%@%' and entry not like '@%'
  ), one as (
    select e, max(full_name) full_name, max(preferred_name) preferred_name, max(matric) matric, max(house) house, max(grad_year) grad_year,
           max(status) status, max(kind) kind, max(until) until,
           array_remove(array_agg(distinct case when src <> 'student' then src end), null) roles
    from ppl group by e
  ), joined as (
    select coalesce(o.e, lower(u.email)) e, o.full_name, o.preferred_name, o.matric, o.house, o.grad_year, o.status, o.kind, o.until, o.roles,
           (o.e is not null) listed, u.id uid, u.email_confirmed_at, u.last_sign_in_at, u.created_at
    from one o full join (select * from auth.users where deleted_at is null) u on lower(u.email) = o.e
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'email', e,
      'name', coalesce(preferred_name, full_name),
      'matric', matric, 'house', house, 'grad_year', grad_year, 'status', status, 'kind', kind, 'until', until,
      'roles', coalesce(roles, '{}'),
      'approved', listed or email_allowed(e),
      'user_id', uid, 'signed_up', uid is not null, 'confirmed', email_confirmed_at is not null,
      'last_sign_in', last_sign_in_at, 'signed_up_at', created_at,
      'alumni', status = 'Graduated',
      'alumni_due', status = 'Active' and (
          (coalesce(kind, 'Regular') <> 'Exchange' and grad_year is not null and make_date(grad_year, 7, 1) <= current_date)
          or (kind = 'Exchange' and until is not null and until < current_date))
    ) order by (uid is null), coalesce(preferred_name, full_name, e)), '[]'::jsonb) into r
  from joined;
  return r;
end $$;

-- One student: the record, positions held, and the latest changes made here.
create or replace function records.student_get(p_matric text) returns jsonb
language plpgsql stable security definer set search_path = records, public as $$
declare s students;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  select * into s from students where matric = p_matric;
  if not found then raise exception 'No such student'; end if;
  return jsonb_build_object(
    'student', to_jsonb(s) - 'photo_url' - 'show_photo',
    'positions', coalesce((select jsonb_agg(jsonb_build_object('ay', ay, 'body', body, 'title', final_title, 'points', points) order by ay desc, body)
                           from roster_view where matric = p_matric), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'by', by_email, 'change', change) order by at desc)
                         from (select * from student_changes where matric = p_matric order by at desc limit 8) c), '[]'::jsonb));
end $$;

-- Change fields of one student. Only the keys present in p are touched:
-- preferred_name, house, grad_year, status (Active, LOA, Graduated, Dropped Out), kind (Regular, Retainee, Exchange), until, notes, email.
-- The email of someone who already has an account is changed with accounts_change_email, not here.
create or replace function records.student_update(p_matric text, p jsonb) returns void
language plpgsql security definer set search_path = records, public as $$
declare s students; ne text; before_v jsonb;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  select * into s from students where matric = p_matric;
  if not found then raise exception 'No such student'; end if;
  if p ? 'status' and (p ->> 'status') not in ('Active', 'LOA', 'Graduated', 'Dropped Out') then raise exception 'Unknown status'; end if;
  if p ? 'kind' and (p ->> 'kind') not in ('Regular', 'Retainee', 'Exchange') then raise exception 'Unknown type'; end if;
  if p ? 'grad_year' and nullif(p ->> 'grad_year', '') is not null and (p ->> 'grad_year')::int not between 2000 and 2100 then raise exception 'Graduation year looks wrong'; end if;
  if p ? 'email' then
    ne := lower(trim(coalesce(p ->> 'email', '')));
    if ne is distinct from lower(coalesce(s.email, '')) then
      if ne !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That does not look like an email address'; end if;
      if exists (select 1 from auth.users where lower(email) = lower(coalesce(s.email, '')) and deleted_at is null) then
        raise exception 'This person has an account. Use Change email on the account so their sign-in moves too.';
      end if;
      if exists (select 1 from students where lower(email) = ne and matric <> p_matric) then raise exception 'Another student already has that email'; end if;
    end if;
  end if;
  before_v := coalesce((select jsonb_object_agg(k, to_jsonb(s) -> k) from jsonb_object_keys(p) k), '{}'::jsonb);
  update students set
      preferred_name = case when p ? 'preferred_name' then nullif(trim(p ->> 'preferred_name'), '') else preferred_name end,
      house          = case when p ? 'house' then nullif(trim(p ->> 'house'), '') else house end,
      grad_year      = case when p ? 'grad_year' then nullif(p ->> 'grad_year', '')::int else grad_year end,
      status         = case when p ? 'status' then p ->> 'status' else status end,
      kind           = case when p ? 'kind' then p ->> 'kind' else kind end,
      until          = case when p ? 'until' then nullif(p ->> 'until', '')::date else until end,
      notes          = case when p ? 'notes' then nullif(trim(p ->> 'notes'), '') else notes end,
      email          = case when p ? 'email' then ne else email end,
      updated_at     = now()
    where matric = p_matric;
  insert into student_changes (by_email, matric, change) values (me_email(), p_matric, jsonb_build_object('before', before_v, 'after', p));
end $$;

-- Add one student by hand (an exchange student, a late joiner). They can then make an account with that email.
create or replace function records.student_add(p jsonb) returns void
language plpgsql security definer set search_path = records, public as $$
declare m text := upper(trim(coalesce(p ->> 'matric', ''))); em text := lower(trim(coalesce(p ->> 'email', '')));
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if m = '' then raise exception 'Matric number needed'; end if;
  if coalesce(trim(p ->> 'full_name'), '') = '' then raise exception 'Full name needed'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That does not look like an email address'; end if;
  if (p ->> 'kind') is not null and (p ->> 'kind') not in ('Regular', 'Retainee', 'Exchange') then raise exception 'Unknown type'; end if;
  if exists (select 1 from students where matric = m) then raise exception 'That matric is already on the roster'; end if;
  if exists (select 1 from students where lower(email) = em) then raise exception 'Another student already has that email'; end if;
  insert into students (matric, full_name, preferred_name, house, email, grad_year, status, kind, until, notes)
    values (m, trim(p ->> 'full_name'), nullif(trim(p ->> 'preferred_name'), ''), nullif(trim(p ->> 'house'), ''), em,
            nullif(p ->> 'grad_year', '')::int, 'Active', coalesce(nullif(p ->> 'kind', ''), 'Regular'), nullif(p ->> 'until', '')::date,
            coalesce(nullif(trim(p ->> 'notes'), ''), 'Added by hand'));
  insert into student_changes (by_email, matric, change) values (me_email(), m, jsonb_build_object('added', p));
end $$;

-- Delete an account (the person can sign up again later if they are still approved). Their roster record and everything they wrote is kept.
create or replace function records.accounts_delete(p_user uuid) returns void
language plpgsql security definer set search_path = records, public as $$
declare em text;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  select lower(email) into em from auth.users where id = p_user and deleted_at is null;
  if em is null then raise exception 'No such account'; end if;
  if em = me_email() then raise exception 'You cannot delete your own account here'; end if;
  delete from auth.users where id = p_user;   -- sessions and identities go with it
end $$;

-- Change the email an account signs in with. The new email must be approved (or p_move is true, which also moves the person's roster /
-- admin / manager rows to the new email first, so it becomes approved). They are signed out everywhere and sign in with the new email;
-- the password stays. Past RSVPs, posts and similar rows keep the old email.
create or replace function records.accounts_change_email(p_user uuid, p_new text, p_move boolean default true) returns void
language plpgsql security definer set search_path = records, public as $$
declare old text; nw text := lower(trim(p_new));
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if nw !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That does not look like an email address'; end if;
  select lower(email) into old from auth.users where id = p_user and deleted_at is null;
  if old is null then raise exception 'No such account'; end if;
  if old = nw then raise exception 'That is already their email'; end if;
  if exists (select 1 from auth.users where lower(email) = nw) then raise exception 'Another account already uses that email'; end if;
  if p_move then
    update students set email = nw, updated_at = now() where lower(email) = old;
    update admins set email = nw where lower(email) = old and not exists (select 1 from admins where lower(email) = nw);
    update body_managers set email = nw where lower(email) = old and not exists (select 1 from body_managers b2 where lower(b2.email) = nw and b2.body_id = body_managers.body_id);
  end if;
  if not email_allowed(nw) then
    raise exception '% is not on the approved list. Add it under Admin > Sign-in list first, or tick "also move their roster record".', nw;
  end if;
  update auth.users set email = nw, updated_at = now(),
         raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(nw)),
         email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = p_user;
  update auth.identities set identity_data = jsonb_set(jsonb_set(identity_data, '{email}', to_jsonb(nw)), '{email_verified}', 'true'::jsonb), updated_at = now()
   where user_id = p_user and provider = 'email';
  delete from auth.sessions where user_id = p_user;
end $$;

-- Mark as Graduated (the app shows Alumni): Active students whose graduation year has passed (from 1 July of that year), and Exchange
-- students whose end date has passed. Returns how many changed. Graduated people keep any account they already have; they cannot make a new one.
create or replace function records.accounts_mark_alumni() returns integer
language plpgsql security definer set search_path = records, public as $$
declare n integer;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  update students set status = 'Graduated', updated_at = now(),
         notes = concat_ws(' · ', nullif(notes, ''), case when kind = 'Exchange' then 'Exchange ended' else 'Graduation year reached' end)
   where status = 'Active' and (
         (kind <> 'Exchange' and grad_year is not null and make_date(grad_year, 7, 1) <= current_date)
      or (kind = 'Exchange' and until is not null and until < current_date));
  get diagnostics n = row_count;
  return n;
end $$;

-- The yearly roster update, as before, with two fixes: the backup names its columns, and Exchange students are never marked LOA or Graduated by it.
create or replace function records.annual_sync(rows jsonb, base_year integer) returns jsonb
language plpgsql security definer set search_path = records, public as $$
declare
  n_verified int := 0; n_grad int := 0; n_loa int := 0; n_added int := 0;
  cohorts int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;

  create temp table _official on commit drop as
    select upper(trim(x ->> 'matric'))                       as matric,
           nullif(trim(x ->> 'full_name'), '')               as full_name,
           nullif(trim(x ->> 'preferred_name'), '')          as preferred_name,
           nullif(trim(x ->> 'gender'), '')                  as gender,
           nullif(trim(x ->> 'house'), '')                   as house,
           nullif(lower(trim(x ->> 'email')), '')            as email,
           upper(trim(x ->> 'cohort'))                       as cohort,
           case upper(trim(x ->> 'cohort'))
             when 'M5' then base_year + 1 when 'M4' then base_year + 2 when 'M3' then base_year + 3
             when 'M2' then base_year + 4 when 'M1' then base_year + 5 end as grad
    from jsonb_array_elements(rows) x
    where coalesce(trim(x ->> 'matric'), '') <> '';

  select count(distinct cohort) into cohorts from _official where grad is not null;
  if cohorts < 5 then
    raise exception 'All five cohorts (M1 to M5) are needed. Found % of 5. Nothing was changed.', cohorts;
  end if;

  insert into students_backup (taken_at, matric, full_name, preferred_name, gender, house, email, grad_year, status, notes, updated_at, photo_url, show_photo, kind, until)
    select now(), s.matric, s.full_name, s.preferred_name, s.gender, s.house, s.email, s.grad_year, s.status, s.notes, s.updated_at, s.photo_url, s.show_photo, s.kind, s.until
    from students s;

  -- Still in an intake list: verify
  update students s set
      grad_year  = o.grad,
      status     = 'Active',
      notes      = 'Verified in current intake',
      house      = coalesce(o.house, s.house),
      email      = coalesce(o.email, s.email),
      updated_at = now()
    from _official o where s.matric = o.matric;
  get diagnostics n_verified = row_count;

  -- Was active, graduation year reached, no longer listed (Exchange students are handled by their own end date)
  update students set status = 'Graduated',
      notes = 'Graduation year reached; no longer in intake lists', updated_at = now()
    where matric not in (select matric from _official)
      and status = 'Active' and kind <> 'Exchange' and grad_year is not null and grad_year <= base_year;
  get diagnostics n_grad = row_count;

  -- Anyone else missing from the lists: leave of absence, graduation pushed back a year
  update students set status = 'LOA', grad_year = case when grad_year is null then null else grad_year + 1 end,
      notes = 'Missing from intake lists. Marked LOA and pushed grad year.', updated_at = now()
    where matric not in (select matric from _official)
      and status not in ('Graduated', 'Dropped Out', 'LOA') and kind <> 'Exchange';
  get diagnostics n_loa = row_count;

  insert into students (matric, full_name, preferred_name, gender, house, email, grad_year, status, notes)
    select o.matric, coalesce(o.full_name, o.matric), o.preferred_name, o.gender, o.house, o.email, o.grad, 'Active', 'New student added'
    from _official o
    where not exists (select 1 from students s where s.matric = o.matric);
  get diagnostics n_added = row_count;

  return jsonb_build_object('verified', n_verified, 'graduated', n_grad, 'loa', n_loa, 'added', n_added);
end $$;

-- ---------- who may call what ----------
revoke execute on function records.accounts_ok() from public, anon;
revoke execute on function records.accounts_list() from public, anon;
revoke execute on function records.student_get(text) from public, anon;
revoke execute on function records.student_update(text, jsonb) from public, anon;
revoke execute on function records.student_add(jsonb) from public, anon;
revoke execute on function records.accounts_delete(uuid) from public, anon;
revoke execute on function records.accounts_change_email(uuid, text, boolean) from public, anon;
revoke execute on function records.accounts_mark_alumni() from public, anon;
grant execute on function records.accounts_ok() to authenticated;
grant execute on function records.accounts_list() to authenticated;
grant execute on function records.student_get(text) to authenticated;
grant execute on function records.student_update(text, jsonb) to authenticated;
grant execute on function records.student_add(jsonb) to authenticated;
grant execute on function records.accounts_delete(uuid) to authenticated;
grant execute on function records.accounts_change_email(uuid, text, boolean) to authenticated;
grant execute on function records.accounts_mark_alumni() to authenticated;
