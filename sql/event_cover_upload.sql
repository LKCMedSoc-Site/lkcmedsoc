-- Let event teams set the event cover picture from the Activities app (Event page tab). Run after sql/event_cover.sql.
--   * a public bucket "event-covers" (3 MB, JPEG/PNG/WebP). Files live in a folder named after the activity id.
--   * only someone who can edit that event page (activities.can_work_activity: ExCo, or the event team while the year is open and the
--     event is not cancelled) can add or remove files in that activity's folder
--   * set_event_page accepts "cover_url": empty to remove it, or a link into THIS event's own folder of the bucket. Any other link is refused.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;

create policy event_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then activities.can_work_activity(((storage.foldername(name))[1])::uuid) else false end);
create policy event_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then activities.can_work_activity(((storage.foldername(name))[1])::uuid) else false end);

create or replace function activities.set_event_page(aid uuid, s jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'activities', 'public'
as $function$
begin
  if not can_work_activity(aid) then raise exception 'Not allowed'; end if;
  if s ? 'cover_url' and nullif(trim(s ->> 'cover_url'), '') is not null
     and trim(s ->> 'cover_url') !~ ('^https://[^/]+/storage/v1/object/public/event-covers/' || aid::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'That cover picture was not uploaded through this event page.';
  end if;
  update activities set
    sphere_event_id = case when s ? 'sphere_event_id' then s ->> 'sphere_event_id' else sphere_event_id end,
    visibility      = case when s ? 'visibility'      then s ->> 'visibility' else visibility end,
    public_summary  = case when s ? 'public_summary'  then s ->> 'public_summary' else public_summary end,
    start_time      = case when s ? 'start_time'      then nullif(s ->> 'start_time', '')::time else start_time end,
    end_time        = case when s ? 'end_time'        then nullif(s ->> 'end_time', '')::time else end_time end,
    rsvp_open       = case when s ? 'rsvp_open'       then (s ->> 'rsvp_open')::boolean else rsvp_open end,
    rsvp_capacity   = case when s ? 'rsvp_capacity'   then nullif(s ->> 'rsvp_capacity', '')::int else rsvp_capacity end,
    rsvp_deadline   = case when s ? 'rsvp_deadline'   then nullif(s ->> 'rsvp_deadline', '')::timestamptz else rsvp_deadline end,
    guest_rsvp_open = case when s ? 'guest_rsvp_open' then (s ->> 'guest_rsvp_open')::boolean else guest_rsvp_open end,
    photos_url      = case when s ? 'photos_url'      then nullif(trim(s ->> 'photos_url'), '') else photos_url end,
    cover_url       = case when s ? 'cover_url'       then nullif(trim(s ->> 'cover_url'), '') else cover_url end
  where id = aid;
end $function$;
