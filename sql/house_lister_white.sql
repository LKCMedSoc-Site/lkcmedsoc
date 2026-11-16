-- Joseph Lister's house colour is white. The site shows it as the darkest grey that still carries white text (#717171).
-- The live database still has the older colour check that only allows the 8 named colours, so this first widens it to also allow
-- a hex colour (the same line as in sql/body_color.sql), then stores white for Lister. Run once in the Supabase SQL editor.

alter table records.bodies drop constraint if exists bodies_color_check;
alter table records.bodies add constraint bodies_color_check
  check (color is null or color in ('blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'slate') or color ~ '^#[0-9a-f]{6}$');

update records.bodies set color = '#ffffff' where level = 'House' and name = 'Joseph Lister' and color is null;
