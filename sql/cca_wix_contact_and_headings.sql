-- From the old Wix site's group pages (2026-11-16). This is exactly what was applied to the live database; it is already run, and safe to run again (every statement is guarded).
--   * restores the sub-headings in the About text of Project Aasha, Make-A-Wish and Teddy Bear Hospital (the earlier import had glued each heading onto its paragraph;
--     the other groups' headings were left as they were: a plain conversion would have removed some of them);
--   * fills Instagram where empty (Project Envision, LKCrew, MedLee, Project Tongxin) and the website for Trigenerational Homecare;
--   * puts each group's own email and its Telegram/Facebook links into its icon-links list (only where that list is empty), then makes the email follow the
--     official contact_email where the two differed (Project Chiang Mai, Trigenerational Homecare).
-- Individual people's emails and Telegram handles listed on Wix are NOT imported.

update records.bodies set about_md = $t$### Our roots

*Aasha* means “hope” in Nepalese, reflecting our mission to bring healthcare to underserved communities in Nepal. Founded in 2015 by LKCMedicine students alongside the Singapore Institute of Technology's (SIT) physiotherapy school and National University Hospital (NUH), Project Aasha is a clinician-led OCIP bridging multiple disciplines.

### Our mentors

Over the years, Project Aasha has has engaged with various specialists, such as spine surgeons, ophthalmologists, and physiotherapists. Our founding mentor, Dr Kumaran Rasappan, is a consultant in musculoskeletal oncology and orthopaedic trauma at NUH – and was the first Singaporean to summit Mount Everest for charity in 2012.

### Our efforts

As one of LKCMedicine’s longest-standing OCIPs, the scope of the project has naturally evolved to meet changing community needs. From 2016–2020, the team focused on eye health in Biratnagar and Gorkha rregions; notably, Dr Rupesh Agrawal and colleagues, in partnership with Birat Eye Hospital, performed 506 cataract surgeries across four days in 2021. Students assisted with various screening and health education efforts, including work at the Gyanchakshu School for the Visually Impaired and in the rural villages of Bung. Data collected during surveys were put towards epidemiological studies, and was later published at various international conferences.

Post-pandemic in 2024, the project has re-established itself in Dharan with a renewed focus on orthopaedic care.$t$ || E'\n\n' || substr(about_md, position('### Schedule' in about_md))
where level = 'CCA/Project' and name = 'Project Aasha' and md5(about_md) = 'b126be4777de0308c2ed1fcbc172f6e3';
update records.bodies set about_md = $t$### WHO ARE WE?

**Make-A-Wish LKC** is a student-led volunteering initiative that partners with the official **Make-A-Wish Singapore** to help grant life-changing wishes for children living with critical illnesses.

We believe that a wish is more than just a dream come true—it is a source of **hope, strength, and joy** for children and their families during some of the most challenging moments of their lives.

### WHAT DO WE DO?

As **Wish Granters**, we accompany each child and their family throughout their unique **Wish Journey**, creating meaningful experiences from start to finish.

Our volunteers are involved in every stage of the journey, including:

**1. Discover the Wish** – Getting to know the Wish Child, building rapport, and uncovering their biggest dream.

**2. Plan the Wish** – Working closely with the family and Make-A-Wish Singapore to bring the child's vision to life.

**3. Build the Magic** – Keeping the excitement alive through personalised interactions, games, surprises, and countdowns leading up to the wish.

**4. Celebrate Wish Day** – Bringing the wish to life and celebrating this unforgettable milestone with the child and their loved ones.

**5. Create Lasting Memories** – Supporting the family throughout the journey and helping create moments of hope, joy, and cherished memories that last a lifetime.$t$ || E'\n\n' || substr(about_md, position('### Schedule' in about_md))
where level = 'CCA/Project' and name = 'Make-A-Wish' and md5(about_md) = '92e4fc9292d8d02acb4e1af47c77e6c4';
update records.bodies set about_md = $t$### WHO ARE WE?

Teddy Bear Hospital is an educational initiative designed to introduce young children in kindergartens to healthy habits and basic medical procedures, alleviating common fears such as white coat anxiety.

### WHAT DO WE DO?

Through hands-on role-playing, children interact with teddy bears, learning how to care for them as they role-play "doctors", while volunteers (known as Teddy Doctors) facilitate these interactive sessions through a series of fun and informative stations, namely:

**1. Healthy Living** – Teaching children the importance of nutrition.

**2. Teddy’s Tummy** – Exploring digestive health and the importance of good hygiene habits.

**3. Help Teddy Breathe** – Understanding the respiratory system.

**4. Fix Teddy Up** – Demonstrating how to care for injuries.

**5. Teddy’s Surgery** – Introducing children to the concept of surgery in a gentle, non-intimidating way.

**6. Diagnose Teddy** – Grand Finale featuring Teddy, our mascot, encouraging kids to observe and diagnose Teddy through specific scenarios.

### NEW AND UPCOMING

Additionally, Teddy Bear Hospital is expanding its reach by introducing tailored sessions and educational videos in NUH's paediatric wards. This new initiative aims to provide young patients with a comforting and educational experience, helping them better understand medical procedures and reduce anxiety during their hospital stays.$t$ || E'\n\n' || substr(about_md, position('### Schedule' in about_md))
where level = 'CCA/Project' and name = 'Teddy Bear Hospital' and md5(about_md) = 'd9f83f44368314e0590f9e91475708ab';
update records.bodies set instagram = '@lkc.envision' where level = 'CCA/Project' and name = 'Project Envision' and instagram is null;
update records.bodies set instagram = '@lkc.rew' where level = 'CCA/Project' and name = 'LKCrew' and instagram is null;
update records.bodies set instagram = '@lkc.medlee' where level = 'CCA/Project' and name = 'MedLee' and instagram is null;
update records.bodies set instagram = '@lkc.projecttongxin' where level = 'CCA/Project' and name = 'Project Tongxin' and instagram is null;
update records.bodies set website = 'https://trigen.sg' where level = 'CCA/Project' and name = 'Trigenerational Homecare' and website is null;
update records.bodies set socials = '[{"kind":"email","url":"lkcmedicine.aasha@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Aasha' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"projectasada@gmail.com"},{"kind":"telegram","url":"https://t.me/+o8M2MVwr2b00MmU1"}]'::jsonb where level = 'CCA/Project' and name = 'Project Asada' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcmed.projectbutanding@gmail.com"},{"kind":"facebook","url":"https://www.facebook.com/profile.php?id=61578656604501"}]'::jsonb where level = 'CCA/Project' and name = 'Project Butanding' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"projectchiangmai@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Chiang Mai' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"telegram","url":"https://t.me/projectiloilo"}]'::jsonb where level = 'CCA/Project' and name = 'Project Iloilo' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkc.projectkaruna@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Karuna' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcmed.projectkolkata@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Kolkata' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcmed.projectsongkeum@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Songkeum' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"telegram","url":"https://t.me/activeageing"}]'::jsonb where level = 'CCA/Project' and name = 'Active Ageing Advocates' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"campsimba@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Camp Simba' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"constructingcarecollaboration@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Constructing Care Collaboration' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"make.a.wish.lkc@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Make-A-Wish' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"telegram","url":"https://t.me/medisign"}]'::jsonb where level = 'CCA/Project' and name = 'Medisign' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"nhglkc@gmail.com"},{"kind":"telegram","url":"https://t.me/nhg.lkc.commhealth"}]'::jsonb where level = 'CCA/Project' and name = 'NHG-LKC CommHealth' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkc.pallipals@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Pallipals' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"telegram","url":"https://t.me/projangel"}]'::jsonb where level = 'CCA/Project' and name = 'Project Angel' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcaleidoscope@gmail.com"},{"kind":"telegram","url":"https://t.me/lkcaleidoscope"}]'::jsonb where level = 'CCA/Project' and name = 'Project LKCaleidoscope' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcprojectprism@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Prism' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcmedicine.soleil@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Project Soleil' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"ntulkc.sgmarrow@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'SGMarrow' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"teddybearhospitalsg@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Teddy Bear Hospital' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"trigenerationalhomecare@gmail.com"}]'::jsonb where level = 'CCA/Project' and name = 'Trigenerational Homecare' and socials = '[]'::jsonb;
update records.bodies set socials = '[{"kind":"email","url":"lkcrewsg@gmail.com"},{"kind":"telegram","url":"https://t.me/+IqLRvw526TNjMjll"}]'::jsonb where level = 'CCA/Project' and name = 'LKCrew' and socials = '[]'::jsonb;
update records.bodies b set socials = (select coalesce(jsonb_agg(case when e->>'kind' = 'email' then jsonb_build_object('kind','email','url', v.official) else e end), '[]'::jsonb) from jsonb_array_elements(b.socials) e) from (values ('Project Chiang Mai', 'lkcmed.projectchiangmai@gmail.com'), ('Trigenerational Homecare', 'trigenerational.slt@gmail.com')) as v(n, official) where b.level = 'CCA/Project' and b.name = v.n and b.contact_email like '%' || v.official || '%';
