import type { CalEvent } from './calendar';

export type PublicEvent = CalEvent & {
  status?: string; visibility?: string;
  rsvp_open?: boolean; guest_rsvp_open?: boolean; checkin_open?: boolean;
  spots_left?: number | null;
  cover_url?: string | null; // optional banner picture (a link, or a file name in the post-photos bucket)
  my_rsvp?: { status: string; code: string } | null;
};
