-- An optional cover picture for an event, shown as a banner on the website (for example the home page event spotlight).
-- Run once in the Supabase SQL editor.
--   * activities.activities.cover_url: a full link, or a file name inside the post-photos storage bucket. Leave empty for no banner.
--   * public_event() now includes it as "cover_url", and so does upcoming_events(), which is built from public_event().
-- Nothing else about who can see an event changes.

alter table activities.activities add column if not exists cover_url text;

create or replace function activities.public_event(aid uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'activities', 'public'
as $function$
declare a activities%rowtype; signed boolean := records.me_email() <> ''; going int;
begin
  select * into a from activities where id = aid;
  if not found or not event_visible(a, signed) then return null; end if;
  select count(*) into going from rsvps where activity_id = aid and status = 'Going';
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'summary', a.public_summary, 'kind', a.kind,
    'body', (select name from records.bodies where id = a.body_id),
    'venue', a.venue, 'start_date', a.start_date, 'end_date', coalesce(a.end_date, a.start_date),
    'start_time', a.start_time, 'end_time', a.end_time,
    'visibility', a.visibility, 'status', a.status,
    'rsvp_open', rsvp_is_open(a), 'guest_rsvp_open', (a.guest_rsvp_open and rsvp_is_open(a)),
    'capacity', a.rsvp_capacity,
    'spots_left', case when a.rsvp_capacity is null then null else greatest(a.rsvp_capacity - going, 0) end,
    'deadline', a.rsvp_deadline,
    'checkin_open', checkin_open(a),
    'photos_url', a.photos_url,
    'cover_url', nullif(trim(a.cover_url), ''),
    'my_rsvp', case when signed then
        (select jsonb_build_object('status', r.status, 'code', r.code)
           from rsvps r where r.activity_id = aid and r.email = records.me_email() and r.status <> 'Cancelled')
      end
  );
end $function$;
