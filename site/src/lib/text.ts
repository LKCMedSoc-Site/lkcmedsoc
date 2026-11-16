/** How long a description may be where it is shown on a card in a list (Student Groups, the House System tiles, committee pages). The group's or house's own page shows it in full. */
export const CARD_MAX = 160;

/** Cuts text at a word at `max` characters and ends it with an ellipsis. Shorter text is returned as it is. */
export function clip<T extends string | null | undefined>(text: T, max = CARD_MAX): T | string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '').replace(/[\s.,;:!?-]+$/, '') + '…';
}
