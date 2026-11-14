-- Imports the written content of the student CCAs from the old Wix site (lkcmedsoc.com/student-ccas/*) into records.bodies.
-- Fills ONLY fields that are empty: anything already written in Records is left alone. Safe to run again.
-- Images are not included (see the separate image step). Personal contacts (individual students' Telegram handles and NTU emails) are deliberately left out.
-- Run once in the Supabase SQL editor.

update records.bodies b set
  description = coalesce(nullif(b.description, ''), v.description),
  about_md    = coalesce(nullif(b.about_md, ''), v.about_md),
  instagram   = coalesce(nullif(b.instagram, ''), v.instagram),
  website     = coalesce(nullif(b.website, ''), v.website),
  contact_email = coalesce(nullif(b.contact_email, ''), v.contact_email)
from (values
  ('Active Ageing Advocates', 'Active Ageing Advocates (AAA) focuses on preventive medicine and behavourial change to enhance the wellbeing of our seniors.', 'Active Ageing Advocates (AAA) is Yong Loo Lin School of Medicine''s first initiative to focus on preventive medicine and behavioural change.

Our vision is to be at the forefront of providing sustainable, long-term health guidance for older adults in Singapore whilst enriching the lives of the seniors by enabling them to age actively in their golden years.

We organise annual health screenings across Singapore ,with our past initiatives taking place at Toa Payoh (2023) and Choa Chu Kang (2024).

This year’s screening is at Senja-Cashew CC (2025) !

Furthermore, we conduct HEAL Workshops that holistically improve the physical, socio-emotional, and cognitive aspects of seniors’ wellness, with follow-ups to assess increased motivation for healthy living habits.

More details: https://tinyurl.com/Active-2025

Join our Telegram channel: [https://t.me/activeageing](https://t.me/activeageing)

### Schedule

- Screening dates: 8,9 November 2025
- HEAL Workshop: October-November 2025', '@activeageingadvocates', null, null),
  ('Anaesthesia SIG', 'The LKCMedicine Anaesthesia SIG aims to serve as an avenue for LKCMedicine students to explore the exciting field of anaesthesiology, critical care medicine and pain management.', 'The LKCMedicine Anaesthesia SIG aims to serve as an avenue for LKCMedicine students to explore the exciting field of anaesthesiology, critical care medicine and pain management. This is done through many events planned throughout the year, including:

### Specialty sharings

### Research opportunities

### Hands-on activities

### Case studies & quizzes on Telegram

What we are most known for is our annual flagship event, Anaesthesia Night! With interactive activities and speakers from all 3 healthcare clusters, participants are given the opportunity to acquire practical knowledge and network with professionals and like-minded students interested in the field!

### Schedule

- Look forward to our flagship event: Anaesthesia Night!', '@lkc.anaessig', null, 'lkcanaessig@gmail.com'),
  ('Blood Donation Drive', 'LKC BDD collaborates with the Singapore Red Cross Society and the Health Sciences Authority to organize blood donation drives at the Clinical Sciences Building.', 'We work closely with Red Cross Singapore to organise Blood Donation Drive events at the Clinical Sciences Building in Novena. These events are open to students, staff, faculty and healthcare workers.

### Schedule

- We organise annual Blood Donation Drive events in conjunction with Red Cross Singapore.', '@lkc.bdd', null, null),
  ('Camp Simba', 'Camp Simba hopes to serve as a platform to provide a safe and conducive environment for children, whose relatives are afflicted with cancer, to have fun.', 'Camp Simba was started to help address the emotional needs of children whose relatives are afflicted with cancer, as they are often left to deal with the large lifestyle and emotional changes on their own. As a result, they often miss out on the simple joys of childhood or adolescence. By providing them with a safe space to have fun and unwind, we hope to provide opportunities for them to befriend other children with similar experiences, with the hope of creating a community where they can draw strength from each other. Hopefully, this will also inspire and equip them with skills to eventually organise the camp for future “Simba Siblings”.

Camp Simba is a joint project between NUS YLLSoM, Duke-NUS and NTU LKCSoM first conceptualised in 2009. Through one main camp and two reunion camps, we hope to provide a safe space for children with cancer-afflicted family members to process their feelings, enjoy their childhood, have fun and forge lasting friendships with one another.

The highlight of Camp Simba is a 3D2N camp conducted in June, followed by two reunion camps in January and March. The main camp is the most important event of Camp Simba, which serves as a platform for fellow campers to bond and interact with their OGLs. Reunion camps provide an opportunity for campers to meet up again, and strengthen their friendships with their OGLs and other campers. Past reunions have been held at the Singapore Zoo and Kok Fah Farm.

### Schedule

- Committee members are mainly involved in the planning of the camp, as well as facilitating reunion camps. There is a minimum commitment of 2 years for M1s, and committee members are expected to attend the 2 Annual General Meetings. The peak period for committee members is February to April, and in mid june, planning the main camp, but does not affect the study period for exams. Volunteer OGLs will only need to commit to attending the main camp and reunion camps, and any training sessions for main camp.', '@campsimba', null, 'campsimba@gmail.com'),
  ('Constructing Care Collaboration', 'Constructing Care Collaboration (CCC) is a student-initiated group with the goal of improving the understanding and care of migrant workers amongst future healthcare professionals.', '### Our Vision

Constructing Care Collaboration was established to improve understanding and care of migrant workers amongst future healthcare professionals. Our initiatives allow students to interact with and serve our migrant brothers, better equipping them to take charge and follow up on their health.

### About Us

Constructing Care Collaboration (CCC) is an initiative by LKC-NTU Medicine and YLL-NUS Medicine aimed at serving the migrant workers who reside among us.

We partner with St Andrews’ Migrant Worker Medical Centre @ Penjuru Migrant Worker Recreation Centre and assist in running the clinic through regular volunteering sessions. Students have the opportunity of clerking, helping out at the pharmacy and sitting in doctor consultations. CCC provides students with the chance to interact and befriend migrant brothers to understand more about their lives and the issues they face in Singapore.

Our flagship event would be the annual health screening organised in partnership with NHG Family Medicine and SIT Physiotherapy. Besides health screening booths, we also incorporate educational games and physiotherapy exercises to empower the migrant brothers in taking charge of their health. Our efforts also include setting up ad-hoc health screening booths at Terusan Recreation Centre in tandem with the events held there (i.e. International Migrants Day, Labour Day, etc.).

### Schedule

- Annual Health Screening: 18th January 2026
- Regular Volunteering: 3h per session, 1-2 sessions per month @ St. Andrews’ Migrant Worker Medical Centre
- Ad-hoc Volunteering: 4h per session, 2-3 times per year @ Terusan Recreation Centre', '@constructingcarecollaboration', null, 'constructingcarecollaboration@gmail.com'),
  ('Dover Park Hospice', 'Dover Park Hospice (DPH) is a non-profit organisation that provides palliative care to individuals. The Tanzanite group is primary involved with befriending the residents of the hospice.', 'Dover Park Hospice (DPH) is a non-profit organisation that provides palliative care to individuals. The Tanzanites group of volunteers primarily conduct befriending activities (i.e. interacting with patients), but may also engage in various other tasks depending on the hospice''s needs.

The various activities we perform include both patient and non patient facing tasks. Patient facing activities involve befriending, medical escort (to appointments) and other miscellaneous activities including playing games with the patients! Non patient facing activities include setting up and taking down decorations and medication stock taking for home care packs.

### Schedule

- Ad Hoc Volunteering when available', null, null, null),
  ('Emergency Medicine SIG', 'LKCMedicine Emergency Medicine (EMed) SIG aims to broaden students'' exposure to EMed through a wide variety of student-initiated events and foster interest in the adrenaline packed career!', 'The LKCMedicine EMed SIG introduces students to the field of emergency medicine through TriMedSoc sharing, our flagship event Emed Night and more!

In AY24/25, we organised EMed Night, where students who are interested in emergency medicine came together to solve a series of tasks that tested their knowledge and response to various immersive scenarios. For example, students played the role of a first responder in a disaster and triage simulation, and learnt how to handle a mass casualty crisis and prioritise care to the injured. Students also had the chance to learn how to do focused trauma ultrasound scans, and bandage wounds. We were joined by EMed physicians Dr Lokesh & Dr Suhairi, our mentors who answered questions from our students.

During TriMedSoc Sharing (in conjunction with NUS YLL and Duke-NUS), students had the chance to connect with doctors and students from all 3 healthcare clusters. They learnt more about how an EMed career and residency is like, and how it differs between clusters.

On the publicity front, the Diagnostic Dilemmas series challenged students with case scenarios and quizzes, exploring trauma care through real-life examples applicable from M1-5. Humans of Emed, a series of interviews of EMed doctors, explored their journey in the career, why they chose this specialty, and life as an ED specialist.

We encourage all students who have an interest in EMed, or watnt o find out more about this fulfilling specialty to join us in our events!

Join our Telegram channel: [https://t.me/+f4rjdgy2atdmNWM1](https://t.me/+f4rjdgy2atdmNWM1)

### Schedule

- Annual Flagship EMed Night
- Annual TriMedSoc Sharing
- Tri-Annual DVC Gathertown Event
- Other Residency Sharings and Case Studies', '@lkc.emed', null, 'lkcemed.sig@gmail.com'),
  ('ENT Society', 'As LKC''s ENT Society, we are dedicated to helping medical students explore ENT early, offering learning resources, events, and insights into life as an ENT specialist.', 'ENT Society is a student interest group (SIG) dedicated to increasing awareness and exposure to the field of Otolaryngology – Head and Neck Surgery (ENT) among medical students. We aim to bridge the gap between early medical education and this highly specialized field by providing opportunities to learn more about ENT through educational events, volunteering opportunities, and quizzes on ENT content. We try our best as we can to cater resources for all medical students, regardless of pre-clinical or clinical years.

Our mission is to make ENT more accessible and approachable by offering a range of resources that highlight not only the clinical aspects of the specialty but also what life is like as an ENT physician and beyond. Whether you''re curious about the anatomy of the head and neck, want to understand surgical procedures, or are exploring career options, ENT Society offers something for everyone.

We collaborate with both ENT physicians of different subspecialties and backgrounds to provide valuable insights and guidance for students considering this rewarding specialty. From hands-on skills sessions to Q&A panels, we support students at all stages of their medical journey with the tools and connections to explore ENT in greater depth.

Join us to discover what makes ENT a dynamic and fulfilling specialty, and to gain early exposure that can help inform your future career path.

Join our Telegram channel: [https://t.me/+m_csySJqfUI3ZjM1](https://t.me/+m_csySJqfUI3ZjM1)

### Schedule

- Organised talks with doctors
- Volunteering opportunities when it arises
- ENT content quizzes per monthly', '@lkc.entsoc', null, 'lkcentsoc@gmail.com'),
  ('Family Medicine SIG', 'LKC''s Family Medicine SIG was established to help medical students get a better understanding of the roles and demands of family physicians.', 'LKC''s Family Medicine SIG was established in 2018, with the vision to cultivate greater awareness and interest in Family Medicine within the LKC student body. Since then, our SIG has grown significantly, and we now have close to 400 active members consisting of current students and alumni.

Our SIG plans and hosts various events across the AY. Our Introduction to Family Medicine event is held annually and aims to give students an insight into the many exciting facets of the speciality. We invite distinguished Family Physicians to share more about their careers and the latest developments in the primary care landscape. Additionally, our Family Medicine Residency talk allows students to hear from current Family Medicine residents about their experience as junior physicians in Family Medicine.

Our SIG also creates and delivers social media content related to Family Medicine. On our Instagram page, students can find academic content regarding common conditions, as well as first-hand interviews from various Family Physicians about their experiences. For students seeking research opportunities, the SIG also serves as a bridge between students and researchers from LKCMedicine’s own Singapore Primary Care Research and Knowledge (SPARK) Network.

Join us to get updates on upcoming talks and research opportunities!

Join our Telegram channel: [https://t.me/+RoQR1eOthIU1MTI1](https://t.me/+RoQR1eOthIU1MTI1)

### Schedule

- Organised talks with family physicians and joint events with other SIGs', '@lkc.fm', null, 'lkcfammed@gmail.com'),
  ('Internal Medicine SIG', 'The LKCMedicine IM SIG is a student interest group with the aims of creating a shared platform for like-minded students interested in IM to gain a better understanding of IM as a career.', '### Events for the year

👨‍🏫 IM subspeciality Sharings: Doctors sharing about their residency experiences and more about what their subspeciality does.

📓 IM Journal Club: IOur own student presenters critique and analyse landmark trials from different subspecialties in Internal Medicine

🎤 Humans of IM: Sharing from doctors on why they chose Internal Medicine and their subspeciality, and to learn more about their daily routines as a doctor

🖋 IM Royale: Telegram bot which have questions covering different aspects from history, investigations to management. Done in a leaderboard format so students can have fun while trying out the questions

👨‍⚕️ IM teachings: Teachings from our content experts on difficult topics in Internal Medicine and also OSCE presentation skills

### Schedule

- Monthly Events', '@lkc.im', null, null),
  ('LKCrew', 'LKCMedicine''s Dance Crew. We’re a student interest group established in 2019 with the aim of fostering a stronger dance culture in LKC through weekly dance sessions and performances.', '### LEARN | Grow Without the Pressure

Whether you’re stepping into a studio for the first time or looking to sharpen your skills, LKCrew is your zero-judgment playground. Pick up new styles, learn at your own pace, and grow alongside batchmates, seniors and juniors in an open, encouraging environment.

### PERFORM | Take the Stage Together

Bring all that energy to life at major school-wide events! From casual showcases to the highlight of our year—the annual finale performance at Freshman Orientation Programme (FOP)—you’ll share the spotlight, vibe with the audience, and forge unforgettable memories with your crew.

### CREATE | Own Your Own Movement

Got a vision or a choreo you’ve been dying to teach? LKCrew is a platform for your creativity. Every member is welcome to step up and host their own open classes, share their unique dance style, and inspire the rest of the community.

### EVENTS | Opportunities to Shine

Freshman Orientation Programme Finale Performance

### Peanut Butter n Jam

### Art and Science of Medicine Festival

Join our Telegram channel: [https://t.me/+IqLRvw526TNjMjll](https://t.me/+IqLRvw526TNjMjll)

### Schedule

- As for commitment, our regular classes will operate similarly to external open classes, where we will be giving more details about the week''s session (song, choreographer etc) and polling attendance before each session.
- Events and performances would be more structured with fixed practice sessions where we will be expecting commitment from our members who signed up for the event.', null, null, 'lkcrewsg@gmail.com'),
  ('Make-A-Wish', 'Make A Wish LKC was established in 2022, and is a partnership with Make-A-Wish Singapore to raise awareness about Make-A-Wish among the medical community and to grant wishes to children with critical illnesses.', '### About Us

WHO ARE WE?

Make-A-Wish LKC is a student-led volunteering initiative that partners with the official Make-A-Wish Singapore to help grant life-changing wishes for children living with critical illnesses.

We believe that a wish is more than just a dream come true—it is a source of hope, strength, and joy for children and their families during some of the most challenging moments of their lives.

WHAT DO WE DO?

As Wish Granters, we accompany each child and their family throughout their unique Wish Journey, creating meaningful experiences from start to finish.

Our volunteers are involved in every stage of the journey, including:

1. Discover the Wish – Getting to know the Wish Child, building rapport, and uncovering their biggest dream.

2. Plan the Wish – Working closely with the family and Make-A-Wish Singapore to bring the child''s vision to life.

3. Build the Magic – Keeping the excitement alive through personalised interactions, games, surprises, and countdowns leading up to the wish.

4. Celebrate Wish Day – Bringing the wish to life and celebrating this unforgettable milestone with the child and their loved ones.

5. Create Lasting Memories – Supporting the family throughout the journey and helping create moments of hope, joy, and cherished memories that last a lifetime.

### Schedule

- General Meetings
- Make-A-Wish Singapore hosts an annual meeting inviting all volunteers to attend', '@lkc.maw', null, 'make.a.wish.lkc@gmail.com'),
  ('Medisign', 'Project MediSign aims to bridge this gap between members of the Deaf community and healthcare providers, and improve healthcare awareness and information accessibility in the Deaf Community.', 'Members of the Deaf community may have poor understandingof their health and common diseases, due to difficulties with command and usage of English and lack of accessibility to healthcare knowledge, from limited deaf-friendly resources in hospitals to poor understanding of Deaf culture by healthcare professionals. This leads to poor compliance to medications, and thus poorer health outcomes in Deaf patients. MediSign aims to bridge this gap. Our programmes target improving medical students'' understanding and appreciation of the Deaf community through subsidised Singapore Sign Language (SgSL) classes as well as improving the Deaf community''s access to healthcare information through workshops conducted to explain common conditions to them.

MediSign volunteers have the opportunity to learn Singapore SignLanguage (SgSL), conducted by Singapore Association for the Deaf(SADeaf), with the course being specially tailored for medicalstudents, including history taking in SgSL and specific medical vocabulary in the curriculum.

Since its conception, Medisign has conducted workshops on diabetes, hypertension, dementia, Parkinson’s disease and more. These workshops have been well received by the Deaf Community! We hope to be able to continue to make healthcare education more accessible, and inspire our volunteers to step up and serve the Deaf Community further.

### Schedule

- Classes for SgSL levels 1-3, subject to availability! Join our telegram channel for more updates.
- We also hold health workshops for the Deaf community on an annual basis.', '@lkc.medisign', null, null),
  ('MedLee', 'Medlee is a student-led acapella group brought together by our members’ shared love for music and performing.', 'Through our passion for music, Medlee spreads the joy of music with others and connects students who enjoy singing and performing. By putting together lively acapella performances, we aim to spark a vibrant music culture within LKCMedicine. We have performed at several events such as Freshman Orientation Programme (FOP), Dinner & Dance (D&D), and Art & Science of Medicine Festival (ASMF). We’d love to have you on board if you enjoy singing and vibing with friends who also love music!

### Schedule

- NA', null, null, null),
  ('MedTech Society', 'Since 2021, the LKCMedicine MedTech Society has been a hub for aspiring medical innovators to explore, learn, and create within the ever-evolving world of Medical Technology.', 'The MedTech Society at LKCMedicine is dedicated to fostering curiosity, innovation, and hands-on experience at the intersection of medicine, technology, and healthcare. Our mission is to empower medical students to explore emerging technologies, understand their clinical applications, and develop skills that will shape the future of healthcare delivery.

Through workshops, demonstrations, and talks, we provide opportunities for students to engage with cutting-edge medical technologies such as mixed reality, artificial intelligence, wearable devices, and digital diagnostics. By bridging the gap between classroom learning and real-world innovation, the MedTech Society helps members gain practical insights into how technology is transforming patient care, surgical planning, and medical education.

Join us to be part of a dynamic community passionate about shaping the next generation of medical technology and advancing patient-centered care!

Join our Telegram channel: [https://t.me/lkcmedtech](https://t.me/lkcmedtech)

### Schedule

- Stay tuned for updates on upcoming workshops or sessions!', '@lkc.medtech', null, 'lkcmedtechsig@gmail.com'),
  ('Neighbourhood Health Service', 'A collaboration between students from LKCMedicine and NUS Medicine among others, aiming to provide underserved rental block residents with access to healthcare.', 'The Neighbourhood Health Service (NHS) is a local community health service project involving LKCMedicine and NUS Medicine among other healthcare students, aiming to provide underserved rental block residents with access to healthcare.

1. Centralised Screening - Over 10 screening modalities (vision, dental, hearing etc.) held at a community centre (Toa Payoh for AY2025).

2. Follow-Up Cycle - Residents with atypical screening results will receive intervention within a 3-month cycle. Residents needing closer monitoring receive phone calls or house visits, and are reconnected to formal healthcare institutions or social support organisations.

3. Community Engagement and Health Education Programme (CEHEP) - Through booths at screening sites and door-to-door education during follow-ups, we aim to empower residents and encourage sustained health-seeking behaviours.

4. Research & Development - Our R&D committee has been the backbone of our project with numerous research publications since 2010. We analyse statistics from the health screening to improve the overall efficacy of the health service.

### Schedule

- For 2025:
- Pre-publicity Dates: 8, 11, 17 & 19 October
- Screening Dates: 25 & 26 October', null, null, null),
  ('NHG-LKC CommHealth', 'In liaison with various partners within NHG to support student volunteerism in initiatives that bridge the gap between healthcare services and the population.', 'NHG-LKC Commhealth is a student-led project that aims to provide students with opportunities to contribute to community healthcare initiatives, while also picking up valuable skill sets and interacting with residents.

We organise interactive Hokkien lessons that cover basic conversational Hokkien and medical vocabulary, taught by professional language coaches from Inksmith. Lessons are taught in English and are open to Year 1 & 2 LKC Medicine students. Having basic dialect proficiency will greatly aid during volunteering and clinicals years alike.

Since our work aims to support the current community programmes organised by our NHG partners, we actively participate in initiatives such as health screenings, elderly befriending etc. Students will have the chance to practise their communication and language skills, and also contribute to community health. Our project flexibility also gives members the opportunity to reach out to organisations the project has not yet worked with and take part in other initiatives of interest.

Through these experiences, NHG-LKC Commhealth hopes to inspire a generation of compassionate, community-oriented doctors who value the importance of communication, empathy and cultural sensitivity in healthcare delivery.

### Schedule

- Meetings/Volunteering are ad hoc and initiative-based', '@lkc.nhgcommhealth', null, 'nhglkc@gmail.com'),
  ('OBGYN SIG', 'The LKCMedicine ObGyn SIG was founded to nurture student interest and understanding in women’s health. Through education, mentorship, and meaningful experiences, we strive to inspire future clinicians', 'The LKCMedicine ObGyn SIG is all about bringing women’s health to life. We’re here to spark curiosity, deepen understanding, and give students an authentic glimpse into the world of Obstetrics and Gynaecology.

From patient stories and consultant insights in our bi-monthly newsletters to bite-sized learning on Instagram, we make O&G engaging and relatable. Our career sharings and residency talks open doors to the many paths within the specialty, while research collaborations and clinician-scientist spotlights connect students with the science driving women’s health forward.

We also believe in learning by doing — whether it’s perfecting your skills at our Suturing and Episiotomy Workshop or testing your knowledge through interactive case quizzes on Telegram.

Join us as we explore, learn, and celebrate the field that brings life into the world — one story, one skill, and one connection at a time.

Join our Telegram channel: [https://t.me/joinchat/RkRyq8wRK8UNl739](https://t.me/joinchat/RkRyq8wRK8UNl739)

### Schedule

- Annual Research Sharing, HO/MO Sharing, Episiotomy Workshop
- Bimonthly Newsletters, Instagram Posts', '@lkc.obgyn', null, null),
  ('Ophthalmology SIG', 'The LKCMedicine Ophthalmology Society was formed in 2019 with the aim of connecting students with an interest in ophthalmology.', 'The LKC Ophthalmology Society is a group of like-minded people who are keen in further deepening their interest in Ophthalmology through meaningful events held throughout the year, within and beyond the school setting.

### Schedule

- residency sharing sessions, MO sharing sessions and slit lamp workshops x2 a year', '@lkc.ophsoc', null, 'lkcophsoc@gmail.com'),
  ('Orthopaedics SIG', 'The Orthopaedic Surgery SIG serves as a platform for students to expound on their interest in orthopaedic surgery.', 'The Orthopaedic Surgery SIG aims to provide an avenue for interested students to explore their interest in the field, engaging with esteemed mentors to further ther passion for the subject matter. We provide several research opportunities and organise several revision sessions to hone students'' skills, be it for examinations or personal interest!

Join our Telegram channel: [https://t.me/+6HqE2vaCvnY2N2Fl](https://t.me/+6HqE2vaCvnY2N2Fl)

### Schedule

- Annual comprehensive MBBS Revision Sessions
- Residency Sharings & Outreach Programmes
- Skills Workshops
- Dedicated Teaching Sessions
- Research Opportunities', '@lkc.ortho', null, null),
  ('Paediatrics SIG', 'The Paediatrics SIG aims to bring together students interested in child health to explore the breadth of paediatric medicine. Through talks, workshops, clinical exposure, and r', 'The Paediatrics SIG is a student-led platform that aims to nurture interest in child health and development among medical students. We provide opportunities for members to explore the wide-ranging subspecialties within paediatrics, from neonatology to adolescent medicine and developmental paediatrics. Through a mix of academic, clinical, and community-focused activities, we hope to inspire the next generation of paediatric clinicians and advocates.

Our initiatives include interactive talks and panel discussions with paediatricians, hands-on clinical skills workshops, career sharing sessions, and opportunities to participate in service learning and research. We collaborate closely with clinicians and hospital departments to give students meaningful exposure to the realities of paediatric practice, both in the hospital and community settings.

Whether you are curious about paediatrics or already set on the specialty, the Paeds SIG provides a supportive community to learn, connect, and grow. Join us as we explore the rewarding and impactful world of caring for children and their families.

### Schedule

- HO/MO sharing Early November!', null, null, 'lkcpaedssig@gmail.com'),
  ('Pallipals', 'Pallipals is a palliative care initiative where our volunteers dedicate time and heart to bringing comfort, companionship, and creative joy to elderly residents in hospice care.', 'Pallipals is a LCIP oriented towards palliative care, aiming to foster a greater understanding towards palliative care among volunteers while providing support and comfort for palliative patients and raising awareness about palliative care among medical students.

Volunteering with the Integrated Community Hospital(ICH) at Tan Tock Seng Hospital

Pallipals volunteers befriend and interact with patients, cheering them up and supporting them through the complex and sometimes negative emotions which may arise during their palliative care journey. Whether it is alleviating their boredom, being a listening ear, or providing emotional support, serving palliative care patients is at the heart of what Pallipals does.

### Volunteering with HCA at Oasis@Outram

Starting last year, Pallipals has also partnered with HCA to organize handicraft sessions and festive activities, as well as providing befriending services to patients at their Oasis@Outram Day Centre. Volunteering with Pallipals is a unique opportunity that will allow you to touch the lives of palliative patients, hone your skills in areas such as communication, empathy, leadership, and learn more about palliative care through valuable first-hand experiences on the ground.

### Schedule

- Volunteering with ICH at Tan Tock Seng Hospital - Fortnightly visits to the wards. Each visit will last around two hours, and volunteers may choose which day they would like to visit the ward.
- Volunteering with HCA at Oasis@Outram - Similar in schedule to volunteering with Ward 83, except each shift is around three hours long.', null, null, 'lkc.pallipals@gmail.com'),
  ('Pathology SIG', 'Welcome to Pathology SIG! Join us if you want to discuss more about the cells and friends who make us, us!', 'We are a society enthusiastic about Pathology and its subspecialties, which all play a vital role in modern medicine!

From anatomical pathology, to microbiology, clinical pathology, and forensic pathology, there''s something for everyone!

Join our Telegram channel: [https://t.me/+es9lPqq7ckMyMTc1](https://t.me/+es9lPqq7ckMyMTc1)

### Schedule

- 26 November 2025: Pathology Residency Sharing
- March 2026: HSA Mortuary visit', null, null, null),
  ('Public Health & Preventive Medicine SIG', 'The Public Health and Preventive Medicine SIG was established with the aim of raising awareness about Public Health/Preventive Medicine as a career and bringing together like-minded students who share an interest in this field', 'Public Health and Preventive Medicine (PHPM) SIG, to put it simply, is about understanding the bigger picture of the healthcare system, preventing and not just treating after people get ill. By focusing on health policies, epidemiology and community health intervention, PHPM forms the backbone of the modern heatlhcare system. Through talks and workshops, members of PHPM SIG are able to appreciate the intricacies and gain valuable insights within this field of medicine. Whether you envision a career in clinical practice, research, or public service, this SIG offers a great platform to explore how population health and clinical medicine intersects to make a difference in our society.

### Schedule

- Check out our annual Public Health and Preventive Medicine sharing!!!', '@lkc.prevmed', null, 'lkcprevmed@gmail.com'),
  ('Project Aasha', 'Project Aasha aims to create sustainable impact and serve rural communities in Nepal through surgical, community health, and education initatives.', 'Our rootsAasha means “hope” in Nepalese, reflecting our mission to bring healthcare to underserved communities in Nepal. Founded in 2015 by LKCMedicine students alongside the Singapore Institute of Technology''s (SIT) physiotherapy school and National University Hospital (NUH), Project Aasha is a clinician-led OCIP bridging multiple disciplines.

Our mentorsOver the years, Project Aasha has has engaged with various specialists, such as spine surgeons, ophthalmologists, and physiotherapists. Our founding mentor, Dr Kumaran Rasappan, is a consultant in musculoskeletal oncology and orthopaedic trauma at NUH – and was the first Singaporean to summit Mount Everest for charity in 2012.

Our effortsAs one of LKCMedicine’s longest-standing OCIPs, the scope of the project has naturally evolved to meet changing community needs. From 2016–2020, the team focused on eye health in Biratnagar and Gorkha rregions; notably, Dr Rupesh Agrawal and colleagues, in partnership with Birat Eye Hospital, performed 506 cataract surgeries across four days in 2021. Students assisted with various screening and health education efforts, including work at the Gyanchakshu School for the Visually Impaired and in the rural villages of Bung. Data collected during surveys were put towards epidemiological studies, and was later published at various international conferences.

Post-pandemic in 2024, the project has re-established itself in Dharan with a renewed focus on orthopaedic care.

### Schedule

- Pre-trip meetings: 1-2 per month
- Trip dates: Mid to Late December', '@lkc.projectaasha', null, 'lkcmedicine.aasha@gmail.com'),
  ('Project Angel', 'Project Angel is a group of passionate medical students who serve members with intellectual and developmental disabilities.', 'Project Angel is a group of passionate medical students dedicated to serving individuals with intellectual and developmental disabilities.Conditions such as Autism Spectrum Disorder (ASD) and Asperger’s Syndrome are often misunderstood, leading to social, mental, and emotional challenges for the individuals and their families.

By partnering with local organisations such as St Andrew’s Autism Centre (SAAC), we aim to build rapport, foster inclusion, and raise awareness of these conditions within our community.

### AY24/25 Events

1. Walk of a LifetimeHeld at St Andrew’s Junior College, this 1.6 km walk across the St Andrew’s school campuses raised awareness of autism. Volunteers from LKCMedicine were stationed to provide refreshments for the participants.

2. Volunteering at SAACEvery Wednesday, committee members visit SAAC’s Siglap campus to assist in the students’ CCA activities. With disabilities ranging from moderate to severe, volunteers gain invaluable first-hand experience interacting with persons with special needs.

3. Chinese New Year Party at Bishan HomeProject Angel celebrated the festive season with elderly residents of Bishan Home for the Intellectually Disabled, hosting a series of CNY-themed games and activities that brought joy to the residents.

Through Project Angel, you’ll find fulfilment in meaningful, hands-on interactions with underrepresented groups; learning empathy, patience, and communication that go far beyond the classroom.

Join our Telegram channel: [https://t.me/projangel](https://t.me/projangel)

### Schedule

- Meetings every month
- Weekly volunteering opportunities with SAAC
- 3-4 one-off events per year', '@lkc.projangel', null, null),
  ('Project Asada', 'Project Asada''s main beneficiary is Baan Eurphon Orphanage in Thailand. We help foster a healthy, clean and nurturing environment for these children to develop and grow.', 'Project Asada is an initiative aimed at improving health outcomes in the town of Lamae, Chumphon, in southern Thailand. Our main beneficiary is Baan Eurphon Orphanage, home to 50+ children aged 0-18 years old and is based in Chumphon Thailand. Our efforts are centered around the children living in Baan Eurphon Orphanage as we identify areas that we can support the orphanage in. These may involve health education, sanitation and hygiene, health and dental screening, developmental assessment for toddlers, first aid, and simply befriending the children. In this vein, we also work with Baan Lam Santi School where most of the children attend, and have engaged two hospitals in the region which provide subsidised healthcare to the children.

Join our Telegram channel: [https://t.me/+o8M2MVwr2b00MmU1](https://t.me/+o8M2MVwr2b00MmU1)

### Schedule

- Pre-trip meetings 1x per month
- Trip dates: 2nd week of June (after Summs)', '@lkc.projectasada', null, 'projectasada@gmail.com'),
  ('Project Bantayan', 'Project Bantayan aims to serve the underprivileged communities of Bantayan, an island North of Cebu province. The main aim is to raise health literacy and accessibility on Bantayan Island sustainably.', '### Medical Missions

In 2026, we conducted 4 medical missions at barangay level. There were medical consultations, dental, diagnostic and laboratory, pharmacy, research and a unique PCR and chest X-ray station assisted by AI for the detection of tuberculosis. These medical missions are organised in collaboration with local medical students from the Cebu Doctors'' University (CDU) and we hope to expand this project further within CDU to make it more sustainable.

### Health Education

We also organise health education programs for elementary school students and high school students separately, teaching different topics such as nutrition, sexual health and stress management.

### Workshops for Barangay Health Workers (BHWs)

BHWs are the first point of contact for residents seeking medical care, as they manage barangay health stations and conduct household visits to follow up with patients. As such, we hope to upskill the BHWs, allowing them to better serve the residents even when we are not there.

### Cebu Doctors'' University Exchange

Every January, students from CDU have an exchange trip to Singapore and LKC Medicine. They would tour the NTU campus and CSB and even sit in for a few TBL sessions. CDU students are also involved in the planning and execution of the medical missions for Project Bantayan. On our trip to Cebu in 2026, we also visited the CDU campus and had a tour around CDU Hospital, where we shadowed the M3s on their clinical visits.

### Schedule

- Pre-trip meetings 1-2x a month
- Trip dates: 1st 2 weeks of July (TBC)
- A 2-year commitment is required.', '@lkc.projectbantanyan', null, null),
  ('Project Butanding', 'Founded in 2024, Project Butanding is among LKCMedicine''s newest OCIPs working in Leyte, Philippines. Together with local partners, we organise health initiatives to improve community health outcomes.', 'In AY26/27, Project Butanding partnered with Volunteer for the Visayans, local Rural Healthcare Units (RHUs), Doña Remedios Trinidad Romualdez Educational Foundation Inc (DRTREFI) and elementary schools under the guidance of our mentor Dr Endean Tan. Our efforts were primarily centred around Tacloban City and its neighbouring barangays (villages).

Prior to the trip, we conducted workshops for our members to better communicate with the locals. We also organised workshops on sexual health and managing chronic conditions with minimal resources that helped to shape our health education curriculum.

In our 2026 trip, Project Butanding conducted health screenings across 5 locations over 4 days, successfully screening 1193 patients. Butanding members were involved in training our volunteers on the protocol for each station including vital signs, eyesight and ECG. Our members also had the opportunity to observe doctors’ consultations, learn about conditions rarely seen in Singapore, practise their clinical and history-taking skills and interact with local pre-med and medical students. Furthermore, we brought essential health knowledge on topics like hygiene, first aid and flood management to 350 children and over 70 teachers, Barangay Health Workers and parents.

Throughout the duration of the trip, our members stayed with local families to gain a truly immersive and personal cultural experience.

### Schedule

- >1 meeting per month, 2 year commitment is required
- Trip dates: end-June to early-July, ~2 weeks long (incl. RNR).', '@lkc.projectbutanding', 'http://www.butanding.org', 'lkcmed.projectbutanding@gmail.com'),
  ('Project Chiang Mai', 'Providing health screenings and education in Phrao, Thailand, in partnership with local organizations to address prevalent medical conditions and improve community health.', 'OCIP Chiang Mai is a student-led programme that offers health screening services and health education in Phrao district in Chiang Mai, Thailand. In partnership with the Little Candles Methodist Church in Phrao, OCIP Chiang Mai seeks to raise awareness of prevalent medical conditions, and to fill the gaps in health screening.

Our team of doctors for the 2026 trip to Phrao consists of Prof Tham Kum Ying, 1 radiologist, 1 internal medicine doctor, 4 paediatricians, 1 physiotherapist, 1 MO, 3 PGY2s, 1 dentist, and 2 translators. Our student team comprises of 6 M1s, 6 M2s, 6 M3s, and 5 M4s. Our team works with Phrao Hospital, 4 clinics, and 8 schools in the Phrao district, where we will be conducting health screenings and health education sessions. In our 2023 trip, our team also conducted a First Aid training session for the teachers at Little Candles Kindergarten. Apart from overseas efforts, OCIP Chiang Mai also had a donation drive in 2022 to collect donations of winter clothes for the villagers of Mae Soon village.

### Schedule

- Every July, to Phrao', '@project.chiangmai', null, 'projectchiangmai@gmail.com'),
  ('Project Davao', 'OCIP Davao serves the Langub and Gumalang villages in Davao City, Philippines, to address their long-term health needs and build long-lasting relationships.', 'Project Davao was founded in 2015 and celebrated its 10th anniversary in 2025, making it one of the longest-running OCIPs in LKC! We serve the Langub and Gumalang barangays in Davao City, Philippines, working not only to address their long-term health needs, but also to build long-lasting ties and relationships with the locals.

Our long-standing partners are Sowing the Master’s Seed Ministry (SMSM), a charitable organisation based in Davao, and our mentor, Associate Professor Eric Yap Peng Huat, who have supported the project since its inception. Led by Rod and Nelly, SMSM has extensive ties within the local community, enabling us to conduct our health education and outreach initiatives that directly benefit the locals.

In addition, we also collaborate with Dr Mae Dolendo, a paediatric oncologist, who has paved the way for many initiatives Project Davao has today, including our multiple health screening programmes. We continue to work closely with her in hopes of expanding our initiatives for House of Hope and creating a stronger impact in Davao. (Read more here: House of Hope)

We also work with Davao Medical School Foundation Inc. (DMSF), Davao''s top medical school, to engage in meaningful exchanges and participate in their community involvement activities.

### Schedule

- Trip Dates: ~10 day trip during end-June/early-July
- Commitment Level: 1 meeting per month, increases near fundraising and the trip itself
- Cost: ~$500 per trip incl. plane tickets', '@lkc.projectdavao', null, null),
  ('Project Daya', 'Project Daya is the longest-running OCIP in LKCMedicine. We aim to empower locals in Kampung Air (KA) and Kampung Puggur (KP), Batam, Indonesia, allowing them to independently take care of their health.', 'Founded in 2013, Project Daya is the longest-running OCIP in LKC. We aim to empower locals in Kampung Air (KA) and Kampung Puggur (KP), Batam, Indonesia, allowing them to independently take care of their health. Through targeted house visits and mass health screenings, we hope to educate locals on health issues prevalent in their community in a sustainable manner. With our long standing partner, Peduli Bangsa (PB), an Indonesian non-profit organisation, and new partner, Yayasan Kasih Anugerah Nusantara (YKAN), we strive to make a difference to the villagers there

### Current Work

Villagers in KA are mostly from rural parts of Indonesia and have come to the urban areas seeking a better life. However, their poor living conditions and limited educational backgrounds have resulted in a myriad of health issues that they may not adequately understand.

### House visits & health education

In teams of 2–3 with a translator, we conduct door-to-door visits to firstly provide personalized health scr eenings and then address health concerns. We also distribute educational brochures on topics like chronic diseases, women’s health, and child nutrition to raise awareness and clarify misconceptions.

### Kindergarten programmes

In recent trips, new partnerships with kindergartens in KA and KP allowed us to conduct health education and screening for children and teens, covering topics like nutrition, dental hygiene, and anti-smoking. Screenings included growth metrics, lice and hand,foot and mouth disease checks, and vision tests. We then collaborated with YKAN to support those with concerning results.

### Being sustainable and following up

We strongly believe that trust and collaboration are important for change. Thus, we are the only OCIP that goes on multiple trips throughout the year, allowing us to build rapport and deepen relations with familiar beneficiaries as they grow to be more familiar and comfortable around us. This foundation of trust thereby allows us to follow up on complex and sensitive cases.

### Building relations with our NGO

On every trip, we aim to strengthen our relations with our friends from PB, empowering them with health information and basic diagnostic skills. We have always been warmly hosted by them and we would celebrate the end of each trip with a large communal meal together. We even celebrated a PB’s member’s birthday on the most recent trip.

### Gathering information

To better identify and meet the needs of our beneficiaries, the Mapping & Database (MAPTA) programme was born. Using a quantitative and longitudinal approach, we map out the labyrinthian landfill villages for resident revisits to review the residents'' progress and our impact.

### Schedule

- 3 trips: October break (4 days), March break (4 days), July break (1 week)
- [Members are expected to attend all trips (with some flexibility)]
- Trip costs are usually under $200; our past 3 trips have all been fully subsidised (apart from
- individual RnR expenses) by grants from the school and fundraising', '@lkc.projectdaya', null, null),
  ('Project Envision', 'Project Envision collaborates with the Singapore Association of the Visually Handicapped (SAVH) to support individuals with visual impairments through inclusive community initiatives.', 'Project Envision is a student-led community intiative that strives to build a more inclusive and accessible society for individuals with visual impairments. We collaborate with the Singapore Association for the Visually Handicapped (SAVH), a national welfare organisation that empowers individuals with visual impairments through training, skill development and community support.

As Singapore becomes more digital, our team aims to bridge the gap between technology and accessibility for individuals with visual impairments. We organise workshops for visually impaired individuals and caregivers to learn how to use assistive tools on their smartphones such as VoiceOver and TalkBack, and we also develop simple, easy-to-follow manuals to support future users and caregivers. Beyond digital skills, we also work closely with the White Cane Club under SAVH. Run by both sighted and visually impaired volunteers, the club supports the social, recreational and welfare needs of its members through activities such as Dining in the Dark, workshops, exercise sessions and community events.

Through these efforts, Project Envision hopes to raise awareness and build a more inclusive and understanding society where individuals with visual impairments can live with independently and confidently.

### Schedule

- Ad Hoc', null, null, null),
  ('Project Iloilo', 'Project Iloilo is the newest OCIP on the block! We serve the local community in Iloilo, Philippines, playing our part in delivering increased accessibility to healthcare.', 'Project Iloilo is a student-led OCIP reaching out to underserved communities in Iloilo City, Philippines, aiming to improve their health via health screenings and education. In Singapore, we partner with YMCA and the Youth Corp Expedition Project, and our Philippines partner is Evangel Tabernacle, a local church.

During our trip, our team of 5 doctors, 10 medical students, and church volunteers held our mobile clinic at 4 locations across 6 days, serving close to 500 patients across 4 different barangays, giving us students opportunities to practise our clinical skills. You can also look forward to collaborations with NUS Project Barrios, an NUS Nursing OCIP, to conduct a modified clinic for children was held at a local elementary school, where we screened close to 150 children for learning disabilities and nutrition needs. Apart from health screening, we conducted health education workshops for teachers, sharing topics like menstrual health, learning disabilities, and mental health with teachers, enabling them to better look out for their students.

Alongside our current work, we also sought out ways to expand our impact on the community, meeting with the mayor and the indigenous community to explore bringing healthcare out of the city, to those who need it the most. We also met with a local anaesthesiologist to explore hospital visits and university exchanges with West Visayas College of Medicine, with many things in store for our future batches (YOU!).

Join our Telegram channel: [https://t.me/projectiloilo](https://t.me/projectiloilo)

### Schedule

- Meetings once a month with increasing frequency leading up to the trip', '@lkc.projectiloilo', null, null),
  ('Project ISIP', 'Project ISIP was established in 2017 with the ongoing aim to provide health screenings and education to rural communities in Bacolod City, Philippines.', 'Each year, Project ISIP brings together a group of medical students to Bacolod City, Philippines, where they work hand-in-hand with local partners, community organisations and hospitals. For the next intake, the group will consist of 4 M2s and 4 M1s, along with TTSH staff and doctors.

This year, in collaboration with the University of St. La Salle (USLS) School of Nursing and a team of seven volunteer doctors (including two paediatricians), we conducted our main medical mission at Barangay Pahonocoy – a village in Bacolod City. Through our health screening portion of our medical missions, we were able to identify conditions in our clients that are perhaps undiagnosed or assist in the follow up of known conditions. Then, our clients are able to start on or continue managing their conditions through medications prescribed by our volunteer doctors. We, as medical students, are heavily involved every step of the way, from briefing our volunteers on their roles, to independently taking histories from clients prior to their consultations and much more. With that, there were plenty of opportunities during the trip to apply medical knowledge.

In collaboration with Hearticulate Psychological Centre, we also engaged with residents in the Missionaries of Charity, in which many of them required psychological assistance. We orientated them with simple craft activities and also conducted health checkups for them, providing us with ample learning opportunity to interact with them.

### Schedule

- 1 meeting a month with increasing frequency nearing the trip to coordinate preparations, training, and logistics.', '@lkc.projectisip', null, null),
  ('Project Janan', 'Project Janan works with Ronald McDonald House Charities to improve the experience of ill children during their hospital stay in National University Hospital (NUH) and Institute of Mental Health (IMH)', 'Project Janan, named after the Arabic word for “heart” and “soul,” is dedicated to bringing joy and comfort to young patients during their hospital stay. We work closely with Ronald McDonald House Charities (RMHC) to support children and their families at the National University Hospital (NUH) and the Institute of Mental Health (IMH).

At NUH, we support Ronald McDonald Family Rooms located in the Neonatal Intensive Care Unit (NICU) and Pediatric Intensive Care Unit (PICU). These rooms offer a space of rest and comfort for families of critically ill children. At IMH, our team engages with children aged 6 to 18 in the Sunrise Wing, which sees over 11,500 outpatient visits and 300 inpatient admissions yearly. Volunteers connect with young patients through interactive activities like storytelling, board games, and arts and crafts.

We also sponsor the Happy Wheels Cart annually at Khoo Teck Puat – National University Children’s Medical Institute (KTP-NUCMI), providing snacks, drinks, and cheer to families during their waiting times. Fundraising and donation drives allow us to keep the cart running for a month each year.

Our mission is simple: to put smiles on little faces and warmth in the hearts of their families. <3

### Schedule

- Happy Wheels Cart at NUH Khoo Teck Puat in February 2026', '@lkc.projectjanan', null, null),
  ('Project Karuna', 'Project Karuna is an OCIP focused on improving the health of Soliga tribal communities in Biligiriranga (BR) Hills, Karnataka, India.', 'Project Karuna is an OCIP focused on improving the health of Soliga tribal communities in Biligiriranga (BR) Hills, India. Mentored by LKCMedicine’s renal module lead, Professor Manohar Bairy, our core vision revolves around two main goals – health education and health screenings – while learning more about the unique rural healthcare demographic and systems of BR Hills.

We are partners with Vivekananda Girijana Kalyana Kendra (VGKK), a NGO dedicated to holistic and sustainable development of the tribal communities in the states of Karnataka and Arunachal Pradesh. We aim to increase health literacy in underserved communities in BR Hills via health education efforts to empower key figures in each tribal hamlet to improve their community’s health. Additionally, we conduct health screenings supported by healthcare workers from VGKK to identify health issues faced by tribal communities, referring them to proper medical treatment. Combined, our main objective is to improve the overall wellbeing of these underserved populations by enabling them to make better health decisions.

Locally, we partner with Saint Andrew’s Migrant Worker Medical Centre (SAMWMC), a medical centre set up by Saint Andrew’s Mission Hospital to provide primary care for our migrant worker communities. Here, Project Karuna conducts health education lessons and engagement sessions modelled after what we do for the Soliga, but more targeted towards workplace safety and emergency first aid.

### Schedule

- Trip dates: late June, 10-14 days (TBC)
- Commitment: 1 meeting per month, peak periods during fundraising and 2-3 weeks before trip to India', '@lkc.projectkaruna', null, 'lkc.projectkaruna@gmail.com'),
  ('Project Kirakira', 'Project Kirakira aims to raise awareness and address the gaps in the care for sexual assault victims in Singapore.', 'Project Kirakira aims to raise awareness and address the gaps in the care for sexual assault victims in Singapore. Through our initiatives, we aim to empower and equip medical students with a deeper understanding of the complexities surrounding sexual assault, ensuring that they are better prepared to support and advocate for survivors in the clinical setting.

### Clinical Communication Workshop

Organised annually, this workshop aims to better equip medical students with skills to sensitively interact with sexual assault victims. We invited expert speakers in the field to shed light on the situation locally and their roles, before sharing tips on how students can handle future scenarios sensitively. Following that, participants apply what they have learned through simulated encounters with simulated participants (SPs).

### AWARE Video Series

Moving forward, Project Kirakira will be starting a video series in partnership with AWARE. We hope to continue educating both students and the public on the issue of sexual assault and bring about meaningful changes.

### Schedule

- Meetings every month', '@lkc.projectkirakira', null, null),
  ('Project Kolkata', 'Established in 2018, we work to empower those affected by the sex-trafficking trade in Kolkata, India, where the largest red light district in Asia is located.', '### Our Vision

Since our inception in 2018, Project Kolkata has aimed to support the women and children affected by sex trafficking through our partnerships with various NGOs. We aim to stand in solidarity with these communities and help address their urgent, intertwined needs. With compassion, humility, and a shared determination to make a difference, we seek to learn from them and contribute to building a healthier, more just world.

### Partnerships

We conduct annual health screenings and health education programmes in collaboration with locally-based partners such as Touch Nature and Tollygunge Women In Need. Sharing a common vision, we work to improve lives through holistic, community-based approaches. We also conduct workshops including art therapy, dance, and science camps for the groups of women and children we meet. In 2026, we''re partnering with Jabala Action Research Organisation to extend our outreach to underpriviledged children and youth.

### Our Efforts

During the COVID-19 pandemic, recognising deepening vulnerabilities and the importance of continuity, we launched a fortnightly online English tuition programme for children supported by Touch Nature. It has continued since, helping us build lasting bonds. Beyond fieldwork in Kolkata, we look forward to our annual fundraiser, Kolkata Khristmas, where we sell products created by women from Touch Nature. We are also working with Saint Andrew’s Migrant Worker Medical Centre to conduct health education programmes as well.

### Schedule

- Members must commit to the project for a total of 2 years. We meet roughly 1-2 times a month, with the frequency increasing around busy periods like fundraising and trip planning.', '@lkc.projectkolkata', null, 'lkcmed.projectkolkata@gmail.com'),
  ('Project LKCaleidoscope', 'Project LKCaleidoscope aims to meet the emotional needs of palliative care patients and their family as they journey through the difficult end-of-life journey through photos and videos.', 'Project LKCaleidoscope was started in 2024 by a group of students passionate about the memories and what it means to people we are close to. Our main beneficiaries are palliative care patients and their families from various healthcare institutions in Singapore.

Our main initiative centres around providing pro bono photoshoots and printing out hard copy pictures for the patients and their families. These photoshoots are supported by our makeup and hairstyling team and befriending team that uplifts the experiences of the patients and their families.

We have worked with Dover Park Hospice and Assisi Hospice to capture photos for their patients. Other organisation such as the Society of St. Vincent de Paul Singapore has very kindly provided us with outfits from their thrift store to support our photoshoots.

Join our Telegram channel: [https://t.me/lkcaleidoscope](https://t.me/lkcaleidoscope)

### Schedule

- Ad-hoc around festive seasons', '@LKCaleidoscope', null, 'lkcaleidoscope@gmail.com'),
  ('Project Prism', 'Project Prism aims to educate medical students on how to best support LGBTQ+ patients in their future work, to ultimately improve outcomes and accessibility in queer healthcare.', 'Project Prism is an LCIP founded in 2024 to improve medical student competencies in supporting queer patients in Singapore through education and exposure, ultimately seeking to bridge gaps and improve outcomes in healthcare for queer patients in Singapore. We are partnered with kayos kollective, a local research lab comprising a diverse team of public health researchers and social workers.

Our annual clinical communications workshop aims to provide basic knowledge about queer identities to facilitate respectful and productive engagement, dispel misinformation that may lead to detrimental or unhelpful care/advice, as well as educate participants about common issues faced by queer patients.

Past speakers at our workshop include Rain Koh, co-founder of Transgender SG, and Dr Jeremiah Pereira, recipient of the APCOM HERO Award 2023 for their work in gender-affirming care. The workshop includes simulated patient (SP) encounters for students to practice their communication skills, conducted with the aid of kayos kollective who provide their expertise through co-creation of SP scenarios tailored for our workshop''s focus, as well as their members who serve as SPs providing authentic responses and feedback.

### Schedule

- Meetings every month
- Annual clinical communications workshop', '@lkc.projectprism', null, 'lkcprojectprism@gmail.com'),
  ('Project Soleil', 'Project Soleil aims to raise awareness on Motor Neurone Diseases (MNDs), and serve afflicted communities within Singapore.', 'Motor Neurone Diseases (MNDs) slowly takes away a person’s ability to move, speak, and even breathe. It’s a devastating condition with no cure, where care and support can make all the difference. Project Soleil exists to explore the struggles of those afflicted with the disease, and strives to deliver community, dignity and support.

Founded in 2021, Project Soleil works in close collaboration with the Motor Neurone Disease Association (MNDa) of Singapore and the Tan Tock Seng Home Ventilatory and Respiratory Services (HVRSS) team. Members are offered the opportunity to join and co-plan MNDa monthly outings, as well as shadow HVRSS on home vists, enabling students to glean first-hand insights into the lived realities of MND and how medical care extends beyond the clinic to transform lives.

Over the years, our initiatives have included clinical seminars with the National Neuroscience Institute (NNI), human library sessions, and passion projects to help MND warriors fulfil their final wishes. Together with NNI and MNDa, Project Soleil has also co-authored a patient-friendly guidebook on the clinical aspects of MND to support patients and caregivers via improving informational access.

Moving forward, Project Soleil is exploring the provision of PCEye devices, which enable communication and digital access through eye-tracking technology, and the development of a second guidebook focused on coping with difficult diagnoses..

### Schedule

- Meetings: Once a month', '@lkc.projectsoleil', null, 'lkcmedicine.soleil@gmail.com'),
  ('Project Songkeum', 'Project Songkeum has been running programmes devoted to increasing the health literacy of the villagers in Cambodia since 2015.', 'Songkeum means hope in Khmer! We aim to empower them to make better healthcare decisions by imparting invaluable healthcare information. Our trip also offers an opportunity to gain deeper insights into the Cambodian healthcare practices through learning journeys to local healthcare and education institutions.

Our distinguishing factor: well-rounded focus on health screening, health education for both adults and children, and vocational training and house visits, contributing to the betterment of the lives of Cambodians!

### Objectives of Project

The mission of Project Songkeum is to help the Cambodian community build better lives for themselves through health screening and health education, and vocational training for those transitioning to the next phase of their lives.

### Activities Conducted

We work with the Salesian Sisters of St. John Bosco to reach out to the underprivileged in Phnom Penh and Mondulkiri through the following:

### Health Screening

- Conducts health screening in villages in Mondulkiri alongside medical professionals

- Connect patients to local healthcare providers, supporting continuity of care

### Health Education

- Cover topics tailored to the unique needs of each community such as medicine literacy, nutrition and more

- Closely aligned with health screening to create a sustainable impact for locals

### Vocational Training (Unique to Songkeum!)

- Provide youths with practical skills such as excel, financial literacy and first aid skills

### Schedule

- Project Songkeum goes for our annual trip every Jun/Jul, for a period of ~10 days!', '@lkc.projectsongkeum', null, 'lkcmed.projectsongkeum@gmail.com'),
  ('Project Tongxin', 'Project Tongxin was founded in 2024 as an OCIP aiming to provide aid in the rural areas of the Qinghai province, specifically addressing healthcare issues related to the high altitude.', 'Project Tongxin was founded in 2024 as an OCIP aiming to provide aid in the rural areas of the Qinghai province, specifically addressing healthcare issues related to the high altitude. We hope to embark on a larger scaled trip providing eyedrops, eye check-ups, health screenings and more by collaborating with our Singaporean dermatologists and ophthalmologists.

Founded in 2024, Project Tongxin is one of four OCIPs in LKCMedicine extending outreach beyond ASEAN. We collaborate with the Tianjin Development Zone Charity Association and its subsidiary, the Tongxin Youth Charity Fund, to provide health education and screenings to communities in Qinghai Province, China. Additionally, we aim to conduct meaningful activities and raise funds to upgrade facilities at Hope Home (希望之家), an orphanage for Tibetan children

Objectives of the Project:

Provide accessible, free eye checkups focused on prevention, early detection, and treatment of common eye diseases.

Brighten the lives of children at Hope Home through physical engagement and improve their living conditions through facility upgrades.

Conduct home visits to understand social determinants of health in rural communities and address disparities in healthcare access.

Cultivate cultural sensitivity and the ability to provide empathetic care to diverse populations.

Activities Conducted:

In July 2025, the Project Tongxin team completed a 7-day recce trip to Qinghai Province, covering Zhuoni County, Xining, and Gannan County. We visited primary schools, conducting basic English lessons and simple eye health education. Due to the region’s high UV exposure, our ophthalmologist provided eye screenings and eyedrops as needed.

At Hope Home, a local orphage, we identified areas for support, including kitchen and classroom upgrades. We also built strong bonds with the children and learned how our funding significantly contributes to their education.

We explored high-altitude environments to understand how geographic isolation affects healthcare access, infrastructure, and disease management.

### Schedule

- 2h per week (dependent on workflow)', '@lkc.projecttongxin', null, null),
  ('Psychiatry SIG', 'LKC Psychiatry SIG was established with the aim of raising awareness about Psychiatry as a career and bringing together students who share an interest in this field.', 'Psychiatry is a multifaceted medical specialty devoted to understanding, diagnosing, and treating mental health conditions. It bridges the biological, psychological, and social aspects of medicine, offering holistic care that supports both mind and body.

LKC Psychiatry SIG aims to inspire and equip students who are curious about mental health and the human mind. We organise a range of activities throughout the year, including Psychiatry Residency talks, subspecialty sharings, interactive workshops on clinical skills and communication as well as academic quizzes. Members also have opportunities to participate in research and mentorship programmes.

Whether you are curious about the mind, exploring psychiatry as a potential career or simply passionate about mental health advocacy, we welcome you!

Join our Telegram channel: [https://t.me/+Nt8GnvvCR9M2MTdl](https://t.me/+Nt8GnvvCR9M2MTdl)

### Schedule

- Psychiatry Residency Sharing
- Psychiatry Human Library
- Psychiatry Research Opportuntiies
- Subspecialty Talks
- Interactive Sessions
- High Yield Revision Quizzes', '@lkc.psych', null, 'lkcpsychiatrysig@gmail.com'),
  ('Radiology SIG', 'The LKCMedicine RadioSIG serves as a community for students who are interested in radiology and its related fields.', null, null, null, null),
  ('Savepoint', 'Savepoint works with Singapore''s Children Society to host an annual health education camp for children and youth from vulnerable backgrounds all over Singapore.', 'Savepoint (Health Education Camp) is an LCIP that works with Singapore Children’s Society to host an annual health education camp that aims to better the health education of the children and youth from Singapore Children’s Society. Through a one-day camp held in CSB, we make use of medical resources like the anatomy lab to guide the participants in understanding the human body and seeing how physiology and pathology can relate to their daily lives. In 2023, a camp centered on MSK and healthy gymming was hosted, with the participants learning about musculoskeletal anatomy, common gymming injuries and basic first aid. In 2025, we focused on vaping and CR health.

Outside of LKC, Savepoint hosts regular interest group sessions for vulnerable children and youth. The interest groups include:

### 1. Baking and Cooking (Sunbeam Place)

### 2. Art (Sunbeam Place)

Joining as a volunteer for interest group sessions will involve planning and facilitating sessions. A volunteer can expect to work closely with the other volunteers and spend time with the children and youth during such sessions. If you have any interest in these or wish to start your own interest group, do contact us!

### Schedule

- For interest groups, the next cycle of volunteer recruitment will be in sem 2.
- Art interest group - fortnightly on Saturdays 10am-12pm
- Cooking and Baking interest group - fornightly on Sundays 2-5pm', null, null, null),
  ('SGMarrow', 'AMSA SGMarrow works with the Bone Marrow Donor Programme (BMDP) to increase the chances for patients with blood-related diseases who require a Bone Marrow Donation (BMD) to find a viable match.', 'SGMarrow is a collaboration between the Asian Medical Students’ Association (AMSA) and the Bone Marrow Donor Programme (BMDP), which builds and manages Singapore’s only register of volunteer bone marrow donors. For some Singaporeans suffering from terminal blood-related diseases, receiving bone marrow from a compatible donor may possibly be their last chance to renew their lives. However, the register still lacks numbers due to the lack of awareness about the programme and misconceptions about the process of bone marrow transplant.

Hence, our project was set up in 2015. It seeks to empower our youth and the public by providing more knowledge on bone marrow donation and blood diseases, as both are topics that may not be well understood. We also aim to encourage more people to sign up for the donor register. This has been done mainly through the organisation of bone marrow donation drives NTU and CSB by LKCMedicine.

We plan to continue organising such donation drives and outreach programmes in NTU. Furthermore, we plan to extend our reach through possible collaboration with other universities, polytechnics and secondary schools. We hope to reach out to more youth to be bone marrow donors and to spread awareness on bone marrow donation.

Thus far, many patients have benefited tremendously from the work of BMDP and we hope you continue positively impacting the lives of many more patients!

### Schedule

- Donation Drive: 2-3 times a year
- Ad-hoc volunteering', '@lkc.sgmarrow', null, 'ntulkc.sgmarrow@gmail.com'),
  ('Surgical Society', 'Through residency engagements, outreach events and academic content, LKC Surgical Society seeks to help students appreciate the transformative power of surgery.', 'LKC Surgical Society was founded in 2016 with the goal of connecting students with surgical specialties and their residency programmes in Singapore. Since then, we have organised talks and events with various surgical subspecialties from GS to Neurosurgery, such as SSKIP with PRAS, Bowel and Bladder Day with KKH Paediatric Surgery, developed approaches to common surgical presentations and sourced for research opportunities. Through our initiatives, we hope students will be inspired to pursue a surgical career in the future, and more importantly, appreciate the ability of surgery to change the trajectory of patients'' lives.

Join our Telegram channel: [https://t.me/+98Z1zUQhMPVhNDk1](https://t.me/+98Z1zUQhMPVhNDk1)

### Schedule

- Refer to our Instagram/Telegram for more updates!', '@lkc.surgsoc', null, null),
  ('Teddy Bear Hospital', 'Teddy Bear Hospital is an educational outreach project organised by NUS and NTU medical students, with the support of National University Hospital Singapore.', 'WHO ARE WE?

Teddy Bear Hospital is an educational initiative designed to introduce young children in kindergartens to healthy habits and basic medical procedures, alleviating common fears such as white coat anxiety.

WHAT DO WE DO?

Through hands-on role-playing, children interact with teddy bears, learning how to care for them as they role-play "doctors", while volunteers (known as Teddy Doctors) facilitate these interactive sessions through a series of fun and informative stations, namely:

1. Healthy Living – Teaching children the importance of nutrition.

2. Teddy’s Tummy – Exploring digestive health and the importance of good hygiene habits.

3. Help Teddy Breathe – Understanding the respiratory system.

4. Fix Teddy Up – Demonstrating how to care for injuries.

5. Teddy’s Surgery – Introducing children to the concept of surgery in a gentle, non-intimidating way.

6. Diagnose Teddy – Grand Finale featuring Teddy, our mascot, encouraging kids to observe and diagnose Teddy through specific scenarios.

NEW AND UPCOMINGAdditionally, Teddy Bear Hospital is expanding its reach by introducing tailored sessions and educational videos in NUH''s paediatric wards. This new initiative aims to provide young patients with a comforting and educational experience, helping them better understand medical procedures and reduce anxiety during their hospital stays.

### Schedule

- General Meetings
- We host General Meetings with NUS and NTU committees every two months.
- Volunteering Sessions
- Winter Cycle (December): 4-5 sessions at kindergartens across Singapore.
- Summer Cycle (June): 4-5 sessions at kindergartens across Singapore', '@teddybearhospital_sg', null, null),
  ('The Final Journey Collective', 'The Final Journey Collective partners with Cheng Hong AMS to give medical students meaningful service-learning experiences honouring individuals who pass away without family or support.', 'The Final Journey Collective is a newly established service-learning initiative that addresses a critical gap in medical education: while students are trained to manage death clinically, there are few structured opportunities to engage with its human dimensions — grief, loss, and dignity. In partnership with Cheng Hong Welfare Service Society’s Afterlife Memorial Service (AMS), the project allows medical students to witness and honour individuals who pass on without next of kin or the means for a proper send-off.

### Schedule

- Meetings every month, yearly workshop and ad-hoc volunteering sessions.', null, null, null),
  ('Trigenerational Homecare', 'We hope that every elderly in Singapore is able to experience the protection, care and love of a family! As healthcare students, we aim to serve the medical, psychological and social needs of elderly', 'We hope that every elderly in Singapore is able to experience the protection, care and love of a family! As healthcare students, we aim to serve the medical, psychological and social needs of elderly in the Northwest through long-term holistic care. We also hope to educate, enable, and empower young adults to become champions of their communities. Our project encompasses 3 different generations - the elderly, university students in healthcare faculties, and secondary school students. Last year, TriGen is proud to celebrate our 10th anniversary, where we celebrate a decade of intergenerational care, connection, and community impact.

During the course of the cycle, each team will conduct regular home visits to follow up on their elderly patients. Throughout this period, the patient''s progress will be monitored and documented. There will be a mid-cycle Multi-Disciplinary meeting where Team Leaders will have the opportunity to discuss their patient''s progress with healthcare professionals and work with the professionals to improve their care plan.

### Schedule

- Team leaders: September 2025 to September 2026
- Home visits strongly recommended to be done fortnightly
- Timing, frequency, and length of visits should be discussed between the team and the patients.
- Committee members: August 2025 to August 2027
- Attend trainings and meetings, oversee a group of team leaders & secondary school students, serve sub-comm roles and responsibilities
- Youth and Mentoring, Education and Manpower, Operations, Marketing and Outreach, Audit, Secretary-Logistics-Treasurer', '@trigenerational.homecare', null, 'trigenerationalhomecare@gmail.com'),
  ('Urology SIG', 'The LKCMedicine Urology Society is a student-led organisation dedicated to fostering interest in Urology through engagement with practising urologists and hands-on experiences', 'The LKCMedicine Urology Society is a student-led initiative dedicated to promoting interest and knowledge in the field of Urology. We aim to connect students with practising urologists, provide hands-on clinical skills exposure, and facilitate networking opportunities within the specialty.

Our mission is to support medical students who are curious about or aspiring to specialize in Urology by creating a platform for education and connection.

### Schedule

- Intro to Urology @ SKH - 9 January 2026, 6.30pm - 9pm', '@lkc.uro', null, 'lkcurosociety@gmail.com')
) as v(name, description, about_md, instagram, website, contact_email)
where b.name = v.name and b.level = 'CCA/Project';
