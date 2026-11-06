// Things that change rarely and are safe to edit by hand.
export const SITE = {
  name: 'LKCMedSoc',
  fullName: "Students' Medical Society, Lee Kong Chian School of Medicine",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lkcmedsoc.com',
  email: 'lkcmedsoc@gmail.com',
  address: "Students' Medical Society, Clinical Sciences Building, 11 Mandalay Road, Singapore 308232",
  applyUrl: 'https://www.ntu.edu.sg/medicine/education/bachelor-of-medicine-and-bachelor-of-surgery-%28mbbs%29',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/lkc.purpleandsilver' },
    { label: 'YouTube', href: 'https://www.youtube.com/@LKCMedicineMedSoc' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@ntu_lkcmedicine' },
  ],
};
