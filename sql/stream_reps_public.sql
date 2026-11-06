-- Show stream representatives on the public website (Meet the Team).
-- records.public_leadership only listed rows flagged is_top, and stream representatives are not top-tier,
-- so the 11 AY26/27 stream reps (Years 3 to 5) never reached the site.
-- Same columns and joins as before; the only change is the extra OR in the WHERE clause.
-- Names only, the same fields already public for year representatives. No emails or matric numbers.

create or replace view records.public_leadership as
 select p.ay,
        p.governance_level as level,
        b.name as body,
        b.parent_committee,
        p.final_title as title,
        s.full_name,
        s.preferred_name
   from records.participation p
   join records.bodies b on b.id = p.body_id
   join records.students s on s.matric = p.matric
  where (p.is_top or p.final_title ilike '%stream representative%')
    and b.status = 'Active';
