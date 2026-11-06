import { initPlasmicLoader } from '@plasmicapp/loader-nextjs/react-server-conditional';

// Plasmic is only used for layout. The words, posts and events stay in our own files and database.
export const PLASMIC = initPlasmicLoader({
  projects: [{ id: process.env.PLASMIC_PROJECT_ID ?? '', token: process.env.PLASMIC_PROJECT_API_TOKEN ?? '' }],
  // While editing, show unpublished changes; the live site only shows what was published in Plasmic.
  preview: process.env.NODE_ENV !== 'production',
});
