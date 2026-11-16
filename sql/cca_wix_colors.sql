-- Colours for the student CCAs, taken from the card colours on the old Wix site (/student-ccas/ocips, /lcips, /clubs). Only fills colour where it is still empty.
-- The site darkens any colour that would be hard to read with white text, so a pale Wix colour appears as a deeper shade of itself. The records.bodies colour check must allow hex (sql/body_color.sql); it does.
-- Source data: tools/cca-wix-meta.json

begin;
update records.bodies b set color = v.c
from (values
  ('Project Aasha', '#4b4b4b'),
  ('Project Asada', '#0b6623'),
  ('Project Bantayan', '#04398f'),
  ('Project Butanding', '#1d78f3'),
  ('Project Chiang Mai', '#1d471c'),
  ('Project Davao', '#2f3e50'),
  ('Project Daya', '#530431'),
  ('Project Iloilo', '#008b8b'),
  ('Project ISIP', '#334eac'),
  ('Project Karuna', '#ff9607'),
  ('Project Kolkata', '#841f02'),
  ('Project Songkeum', '#005127'),
  ('Project Tongxin', '#820000'),
  ('Active Ageing Advocates', '#2a5b88'),
  ('Blood Donation Drive', '#a81212'),
  ('Camp Simba', '#d67229'),
  ('Constructing Care Collaboration', '#02384f'),
  ('Dover Park Hospice', '#4f7a4b'),
  ('Make-A-Wish', '#1f31ae'),
  ('Medisign', '#7c16a8'),
  ('NHG-LKC CommHealth', '#52003a'),
  ('Neighbourhood Health Service', '#034482'),
  ('Pallipals', '#522081'),
  ('Project Angel', '#4b0082'),
  ('Project Envision', '#772b02'),
  ('Project Janan', '#b5c3f7'),
  ('Project Kirakira', '#117da6'),
  ('Project LKCaleidoscope', '#2aa272'),
  ('Project Prism', '#8392be'),
  ('Project Soleil', '#763c00'),
  ('SGMarrow', '#ff9e4f'),
  ('Savepoint', '#7ba437'),
  ('Teddy Bear Hospital', '#c62020'),
  ('The Final Journey Collective', '#301934'),
  ('Trigenerational Homecare', '#502861'),
  ('LKCrew', '#2b3a67'),
  ('MedLee', '#800020')
) as v(n, c)
where b.name = v.n and b.level = 'CCA/Project' and b.color is null;
commit;
