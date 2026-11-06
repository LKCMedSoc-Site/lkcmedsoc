// Photos for the home page: file names inside the post-photos storage bucket. Swap any of them for another photo from the library.
export const PHOTOS = {
  hero: 'c53c3073-f840-5d4c-a1d7-de6012c90785/0276c4f7b3.jpeg',
  service: 'e63f4fd3-d7ac-560f-a2f8-89eb66b687da/0fda538b15.jpg',
  events: '21af670a-bee6-5d18-ad9a-c362b2998aa8/96f017e618.jpg',
  academic: '67b40e89-25a5-57fd-a39b-34bb156b356b/2211af9a29.jpg',
  join: 'ac90bd78-f81f-5fa2-a2a4-19b79adc0de3/2a01872272.jpeg',
};

// Home page words, copied from the current Wix site. TinaCMS will take over editing these.
export const HOME = {
  heroTitle: 'We are LKCMedSoc',
  heroTagline: 'Through academic support, welfare initiatives, and vibrant events, MedSoc holistically empowers doctors whom you and I would like caring for us.',
  intro: 'We are the student organisation representing all medical students at LKCMedicine.',
  whatWeDo: [
    { title: 'Service', text: 'We act as a bridge between students and the school, while driving meaningful service both locally and overseas.', href: '/student-life/local-cips' },
    { title: 'Events', text: 'We bring the community together through vibrant events that foster connection, celebration, and well-being.', href: '/events' },
    { title: 'Academic', text: 'We support learning through career talks, senior-junior teaching, and accessible academic resources.', href: '/student-life' },
  ],
  testimonials: [
    { quote: 'My journey at LKCMedicine has been an incredible experience filled with growth and inspiration.', who: 'Xavier Ong Chong An, Class of 2028' },
    { quote: 'LKCMedicine offers a large variety of opportunities to support your medical school journey.', who: 'Loh Yong Kang, Class of 2029' },
  ],
  // To be replaced by live counts from the records data (build step 6).
  numbers: [
    { value: '800+', label: 'Medical students' },
    { value: '40+', label: 'Student CCAs' },
    { value: '150+', label: 'Annual events' },
  ],
};
