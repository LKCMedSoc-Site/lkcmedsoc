-- Points each house rep's photo_url at the file uploaded by: node tools/import-rep-photos.mjs
-- Only fills photo_url where it is empty. Does NOT touch show_photo: a photo stays private until its owner ticks "show my photo on the website".

begin;
update records.students s set photo_url = v.url
from (values
  ('U2650600F', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650600F/wix-805bd3dc8e.webp'),
  ('U2550301K', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550301K/wix-9c5b06be25.webp'),
  ('U2450471H', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450471H/wix-b01e805e6a.webp'),
  ('U2350480H', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2350480H/wix-e33fabeb1e.webp'),
  ('U2250450G', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2250450G/wix-23135133c2.webp'),
  ('U2650701E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650701E/wix-f260df4d25.webp'),
  ('U2550250A', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550250A/wix-e8cb703f57.webp'),
  ('U2450570C', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450570C/wix-69f1f051ed.webp'),
  ('U2350130E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2350130E/wix-465e41bdb9.webp'),
  ('U2250860D', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2250860D/wix-c542df0606.webp'),
  ('U2650020J', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650020J/wix-81586ed9a3.webp'),
  ('U2550090K', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550090K/wix-13ebf2acca.webp'),
  ('U2450731G', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450731G/wix-79b0878ac6.webp'),
  ('U2650950J', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650950J/wix-627051797b.webp'),
  ('U2550780B', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550780B/wix-94664d8a49.webp'),
  ('U2450940H', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450940H/wix-ee6b090a5e.webp'),
  ('U2350920E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2350920E/wix-1d8d3a5bd6.webp'),
  ('U2250451J', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2250451J/wix-76f8154bb0.webp'),
  ('U2650350E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650350E/wix-24f0c58bd4.webp'),
  ('U2550650L', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550650L/wix-d12775629e.webp'),
  ('U2450590K', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450590K/wix-b35cbd34f7.webp'),
  ('U2350200H', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2350200H/wix-a688027dd3.webp'),
  ('U2250841K', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2250841K/wix-3c29351a85.webp'),
  ('U2650941B', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650941B/wix-66527dbe0a.webp'),
  ('U2550721E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550721E/wix-f58650619e.webp'),
  ('U2450690G', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450690G/wix-ca5b7cd302.webp'),
  ('U2650580D', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650580D/wix-23309e14a1.webp'),
  ('U2550901C', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550901C/wix-167decfea2.webp'),
  ('U2450291K', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450291K/wix-b1c3235316.webp'),
  ('U2350231D', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2350231D/wix-9e66b654a5.webp'),
  ('U2250940E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2250940E/wix-dea8a6afbd.webp'),
  ('U2650051E', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2650051E/wix-4ee55d361c.webp'),
  ('U2550480L', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2550480L/wix-b1e483256c.webp'),
  ('U2450311A', 'https://brwdgbitxisadwbuwbdi.supabase.co/storage/v1/object/public/leader-photos/U2450311A/wix-84f449fdfb.webp')
) as v(matric, url)
where s.matric = v.matric and coalesce(s.photo_url, '') = '';
commit;
