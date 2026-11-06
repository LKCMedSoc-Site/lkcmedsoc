import type { CalEvent } from './calendar';

export type PublicEvent = CalEvent & {
  status?: string; visibility?: string;
  rsvp_open?: boolean; guest_rsvp_open?: boolean; checkin_open?: boolean;
  spots_left?: number | null;
  my_rsvp?: { status: string; code: string } | null;
};
