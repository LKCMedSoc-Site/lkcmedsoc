# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two audiences, equally weighted: current students of the Lee Kong Chian School of Medicine (NTU) who use the site as a working hub (events and RSVPs, student life, CCAs, news, Students' Corner), and prospective applicants and outsiders who judge the school's student community from it.

## Product Purpose
Public website of LKCMedSoc, the Students' Medical Society representing all LKCMedicine medical students. It shows what the society does (service, events, academic support), lists upcoming events and news from live data, presents leadership and the honour roll, and routes applicants to the MBBS programme page.

## Capabilities and Constraints
- Next.js App Router + Tailwind 4 in `site/`; data from Supabase (events, posts, records); static pages from Markdown in `content/`.
- Menu in `src/lib/nav.ts`; site facts in `src/lib/site.ts`; home copy in `src/lib/home.ts`.
- Sign-in with NTU email on the page (AuthBox).
- Plasmic is used for layout editing; keep components Plasmic-registered where they already are.

## Brand Commitments
Name: LKCMedSoc / Students' Medical Society. Purple (p900 #3a0a2e family) and silver identity; DIN and DIN Engschrift fonts hosted in Supabase storage. Binding: the user chose to build on the existing v2 look rather than replace it.

## Evidence on Hand
Real photos in the Supabase `post-photos` bucket, two student testimonials, real event/news data. Numbers (800+ students, 40+ CCAs, 150+ events) are written placeholders; the CCA count is live.

## Product Principles
- Serve students' daily use first without losing the applicant's first impression.
- Real photographs and live data over decoration.
- Content stays editable by non-developers.

## Accessibility & Inclusion
Respect reduced motion (already handled); keep visible focus states and AA contrast.
