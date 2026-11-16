-- House text imported from the old Wix site (lkcmedsoc.com/houses/<house>), 2026-11-16.
-- Fills description (the "Named after..." line), about_md (the "About us" text) and color. Only fills fields that are still empty, so it is safe to run again.
-- Colours: the four houses whose Wix page names a colour (Curie yellow = amber, Fleming green, Lim Boon Keng blue, Osler red) plus Goh (orange, from her crest).
-- Wu Lien-Teh's page says black, so it is set to slate (the closest option). Franklin and Lister are left on the automatic colour (their pages name none).
-- Images are imported separately: node tools/import-cca-images.mjs --level House --manifest house-images.json

begin;
update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Marie Curie (1867-1934), a Polish-French physicist and chemist who was a pioneer in research on radioactivity and the use of radium for medical diagnostics. She was the first person honoured with two Nobel prizes in Physics in 1903 and Chemistry in 1911.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$Marie Curie’s works were revolutionary—the discovery of radioactivity forever changed our perception of life. In rogue hands it had borne us nuclear weapons; in clinicians’ hands it had borne us powerful diagnostic tools.

No less revolutionary was Marie Curie’s life.

The patriot returned to Poland during the World War 1 and personally drove x-ray equipped ambulances to the front lines, ensured that her France-raised children knew their native language and had seen their native land, and dedicated naming one of her discovered elements, Polonium, after her native country.

Her hunger for excellence undergirded her pioneering spirit, where, disregarding social norms against female education, she worked her way to a place in Sorbonne, France, and ultimately became the first female Professor of General Physics in the Faculty of Sciences in Sorbonne. Her intrigue in radioactivity was not mere fascination but extended to a pursuit of greater understanding of the works of physicists Roentgen and Becquerel.

Hence, in piety, pursue. Piety, because she had a dogged appreciation for her homeland, and an unwavering focus on individual excellence societal contribution regardless of fame or tribulation. Pursue, because in all her life she knew she had a potential she had yet fulfilled.

And so we shall. As she remained true to those who mattered, and true to herself; as she challenged herself all her life—so we must, in piety, pursue.

Which creature more fitting to portray Marie Curie’s traits, than a wolf? They are pious towards their pack, and grace every challenge.

With that, our house has decided to honour Marie Curie with a wolf as our house mascot, and yellow, in remembrance of her great contribution to radioactivity, as our house colour.$wix$ else about_md end,
  color = coalesce(color, 'amber')
where level = 'House' and name = 'Marie Curie';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Sir Alexander Fleming FRSE FRS FRCS (1881-1955), a Scottish biologist, pharmacologist and brilliant researcher. He was known for the discovery of the enzyme lysozyme in 1923 and the antibiotic substance penicillin in 1928. He shared the 1945 Nobel Prize in Physiology or Medicine with Howard Florey and Ernst Boris Chain.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$Sir Alexander Fleming is best known for his discovery of penicillin in 1928, for which he was awarded the Nobel Prize in Physiology or Medicine in 1945. His discovery heralded the dawn of the antibiotic age, forever changing the face of modern medicine. The Alexander Fleming House chose the otter as our House Mascot, and green as our official colour, in the hopes of embodying the virtues of this incredible role model.

The otter is curious, resourceful and adaptable.  They have been known to live in a variety of habitats, and are well-known for using tools such as rocks to open shellfish. These are qualities surely seen in the story behind penicillin. While others may have very easily discarded the mouldy petri dishes, Fleming instead took it and discovered something great. In the same way, we as a house hope to emulate this sense of discovery that Fleming had.

The otter is shy and humble. By one biographer’s account, Fleming was given 25 honorary degrees, 26 medals, 18 prizes, 13 decorations, the freedom of 15 cities and boroughs, and honorary membership in 89 academies and societies. Yet in the midst of his fame and honours Fleming remained modest, and chose not to patent penicillin, hoping that this would help to develop the product as a cheap and effective drug.

Lastly, the otter is also associated with joy and playfulness, and are social creatures that live in large communities. Above all, we chose the otter as these values represent our vision for the house. As a house, we aspire to create an environment of support away from the academic rigours of school, where above all we are able to unwind and enjoy our lives as students.

The colour green has always been associated with balance, health and life. More importantly, it is the colour of spring, nature, and represents growth and newness. We believe that this aptly symbolizes the incredible achievement of Sir Alexander Fleming in the discovery of penicillin, and how his discovery has grown and opened the world to the new field of antibiotics.$wix$ else about_md end,
  color = coalesce(color, 'green')
where level = 'House' and name = 'Alexander Fleming';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Cynthia Goh (21 November 1949 - 13 February 2022), a pioneering figure in palliative care in Singapore. Born in Hong Kong, Goh moved to London to study at St Bartholomew's Hospital, University of London, graduating in 1974. She became one of the first volunteer doctors caring for terminally ill patients at St Joseph’s Home, Singapore, in 1986 and later led the Hospice Care Group (HCG), which became HCA Hospice Care, Singapore's largest home hospice provider. Goh was Head of the Department of Palliative Medicine at the National Cancer Centre Singapore (NCCS) and chaired the Asia Pacific Hospice Palliative Care Network.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$The sparrow was chosen as our house animal because it represents resilience, adaptability, and community—qualities that Cynthia Goh embodied in her pioneering work in palliative care. The sparrow's ability to thrive in various environments parallels Goh's dedication to overcoming challenges in providing care for terminally ill patients. The sparrow also symbolizes cooperation and support, reflecting Goh’s role as a mentor and leader in palliative care. This spirit of empathy and perseverance is what we strive to embody in Cynthia Goh House.$wix$ else about_md end,
  color = coalesce(color, 'orange')
where level = 'House' and name = 'Cynthia Goh';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Dr Lim Boon Keng (1869-1957), a Malayan medical doctor, scholar, educator, legislator, entrepreneur, community leader, social reformer and philanthropist. Dr Lim was a powerful orator and prolific writer who promoted education and social reforms in Singapore and China.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$Lim Boon Keng was a man known for his servant leadership; he pioneered change through social and educational reforms in the early 1900s, empowering Straits Chinese women through education. Similarly, the horse has for centuries served man as a form of transport and a comrade in war, and we want to be inspired by its humility, loyalty and industriousness.

In both Eastern and Western culture, the horse is associated with strength, nobility and steadfastness. The French word for horse is "cheval", and it is the root word for Chivalry. So it is that Lim Boon Keng House strives to be trustworthy and honorable. While the stallion is prized for its speed and power, it is its elegance that we wish to emulate. Just like the horse, we emerge from adversity gracefully and with composure, ready to forge ahead.

In the modern age of domesticated horses, horse lovers will tell you that they are sensitive, knowing creatures, responsive to the moods and nuances of its rider. It is our hope that as future clinicians we will be as gentle and wise in caring for our patients as a mare to her foal.

We chose blue as our house colour because it is associated with intelligence and strength. Not an unbridled, wrathful display of power, but a calm assurance of inner fortitude. While on our journey to become doctors, the colour blue reminds us to cultivate a habit of contemplation as we seek to provide the best care to our future patients. With inner strength, we can then be resilient as a House, come what may.$wix$ else about_md end,
  color = coalesce(color, 'blue')
where level = 'House' and name = 'Lim Boon Keng';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Sir William Osler, 1st Baronet (1849-1919), a Canadian pathologist, physician, educator, bibliophile, historian and author. He is known as the "father of modern medicine".$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$Our choice of the deer embodies the magnificence of the stag and the gentleness of the doe. William Osler was a firm believer in having a balance between books and men. He recognised that the medical student should be able to sit still and focus on gaining knowledge, while also acknowledging the importance of student life and social circles that goes beyond out studies. In the same way, we want our house to exceed in and out of the classroom, being a house that we are proud of, while at the same time provide the family of support that we need throughout our rigorous medical education.

Unlike other horned creatures such as the antelope, most species of deers shed their antlers every year. Similarly, we know that we need to keep up with the times, as Osler stressed upon multiple times, keeping up to date in terms of knowledge as well as in our thinking.

We chose red as our colour for our house as it is associated closely with controlled power, determined ambition and Dignity, qualities that we would like associated with our house. Furthermore, red is famous for its pinot noir and chardonnay wine varieties, and they believe firmly in the concept of terroir, which, loosely translated refers to the combination of soil, climate, aspect to the sun and geography being fundamental, defining influences on a finished wine. In the same way, we acknowledge that there are many things needed to be good doctors, and are dedicated to diligently working on these components, eventually graduating as doctors you and I would like caring for us.$wix$ else about_md end,
  color = coalesce(color, 'red')
where level = 'House' and name = 'William Osler';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Rosalind Franklin (25 July 1920 – 16 April 1958), a British chemist whose work with X-ray diffraction was critical to understanding the molecular structures of DNA, RNA, viruses, coal, and graphite. Educated at St Paul’s Girls’ School and Newnham College, University of Cambridge, she graduated in 1941 with a degree in physical chemistry. Franklin's famous X-ray diffraction images of DNA, especially Photo 51, were key in discovering the DNA double helix structure. She continued pioneering work on virus structures at Birkbeck College until her untimely death in 1958.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$The bear was chosen as our house animal because it represents strength, resilience, and intelligence—qualities that Rosalind Franklin embodied in her groundbreaking work in molecular biology. The bear's ability to thrive in diverse environments mirrors Franklin's dedication to understanding complex molecular structures like DNA, RNA, viruses, coal, and graphite. The bear also symbolizes protection and introspection, reflecting Franklin’s meticulous and pioneering approach to her research. This spirit of determination and wisdom is what we strive to embody in Rosalind Franklin House.$wix$ else about_md end
where level = 'House' and name = 'Rosalind Franklin';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Dr Wu Lien-Teh (1879-1960), a Malayan physician who was an important figure in early 20th century epidemiology. He was nominated for the 1935 Nobel Prize in Physiology or Medicine for his work on the Pneumonic Plague.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$The phoenix was chosen as our house animal because it represents the element of fire, which ties in very closely with Dr Wu's belief in the use of cremation to stop the spread of the plague at all cost. His never-dampening resolve and strength of will as demonstrated in his fight against the plague lives on to this very day in all healthcare professionals, and is represented by the eternal flame of the phoenix. Lastly, the whole idea of rising from the ashes represents our belief that our house will always grow in adversity and stand up stronger wherever we may fall.

The main reason why we chose black for WLT is because black represents ash, which is where the Phoenix (our house animal) undergoes its rebirth when it is struck down. It also ties in with the modus operandi of Dr Wu Lien Teh, which was cremation of the bodies of people who have passed on from the plague.$wix$ else about_md end,
  color = coalesce(color, 'slate')
where level = 'House' and name = 'Wu Lien-Teh';

update records.bodies set
  description = case when coalesce(description,'')='' then $wix$Named after Joseph Lister (1827-1912), a pioneering British surgeon whose work revolutionised medical practices through the introduction of antiseptic surgery. He was appointed Professor of Surgery at the University of Glasgow at 33 and experimented with carbolic acid as an antiseptic, publishing his findings in The Lancet. Lister’s antiseptic techniques are fundamental to modern surgery, reducing the risk of infection. He was made a baronet in 1883 and later elevated to the peerage as Baron Lister of Lyme Regis in 1897.$wix$ else description end,
  about_md = case when coalesce(about_md,'')='' then $wix$The owl was chosen as our house animal because it represents wisdom, knowledge, and keen insight—qualities that Joseph Lister embodied in his pioneering work in antiseptic surgery. The owl's ability to see through darkness parallels Lister's ability to see beyond conventional medical practices and introduce revolutionary antiseptic methods. The owl also represents vigilance and precision, reflecting Lister’s meticulous approach to medical science. This spirit of wisdom and innovation is what we strive to embody in Joseph Lister House.$wix$ else about_md end
where level = 'House' and name = 'Joseph Lister';

commit;