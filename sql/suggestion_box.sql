-- Suggestion box. Paste into the Supabase SQL Editor and run once.
create table activities.suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('Suggestion','Complaint','Website problem','Welfare / other')),
  message text not null check (char_length(message) between 5 and 3000),
  submitter_email text,
  contact text,
  status text not null default 'New' check (status in ('New','Looking into it','Done','Declined')),
  reply text,
  replied_at timestamptz,
  show_public boolean not null default false
);
alter table activities.suggestions enable row level security;

create table activities.suggestion_log (
  email text not null,
  created_at timestamptz not null default now()
);
alter table activities.suggestion_log enable row level security;

create policy exco_all on activities.suggestions
  for all to authenticated using (activities.is_exco()) with check (activities.is_exco());

create function activities.submit_suggestion(p_category text, p_message text, p_anonymous boolean, p_contact text)
returns void language plpgsql security definer set search_path = '' as $$
declare em text := auth.jwt()->>'email';
begin
  if em is null then raise exception 'Please sign in'; end if;
  if (select count(*) from activities.suggestion_log
      where email = em and created_at > now() - interval '1 day') >= 5
  then raise exception 'Daily limit reached, try again tomorrow'; end if;
  insert into activities.suggestion_log(email) values (em);
  insert into activities.suggestions(category, message, submitter_email, contact)
  values (p_category, p_message, case when p_anonymous then null else em end, nullif(trim(p_contact),''));
end $$;

create function activities.reply_suggestion(p_id uuid, p_status text, p_reply text, p_public boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  update activities.suggestions
     set status = p_status, reply = nullif(trim(p_reply),''),
         replied_at = now(), show_public = p_public
   where id = p_id;
end $$;

create view activities.public_suggestions as
  select category, message, status, reply, replied_at
  from activities.suggestions where show_public order by replied_at desc;

grant execute on function activities.submit_suggestion(text,text,boolean,text) to authenticated;
grant execute on function activities.reply_suggestion(uuid,text,text,boolean) to authenticated;
grant select on activities.public_suggestions to anon, authenticated;
