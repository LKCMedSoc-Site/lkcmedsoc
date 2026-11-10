'use client';
import { useEffect, useState } from 'react';

/**
 * Pages for a hub's list. `pageSize` 0 means no paging (everything is one page). The page goes back to 1 whenever `resetKey` changes
 * (the hubs pass their search and filters, so a new filter never leaves you on page 4 of nothing).
 */
export function usePaging(total: number, pageSize: number, resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const size = pageSize > 0 ? Math.floor(pageSize) : 0;
  const pageCount = size ? Math.max(1, Math.ceil(total / size)) : 1;
  const current = Math.min(Math.max(1, page), pageCount);
  const clamp = (n: number) => Math.min(pageCount, Math.max(1, Math.round(Number(n) || 1)));
  return {
    size, page: current, pageCount,
    from: size ? (current - 1) * size : 0, to: size ? current * size : total,
    next: () => setPage(clamp(current + 1)), prev: () => setPage(clamp(current - 1)), go: (n: number) => setPage(clamp(n)),
    fields: {
      page: current, pageCount, pageSize: size, hasNextPage: current < pageCount, hasPrevPage: current > 1,
      pageText: `Page ${current} of ${pageCount}`,
      pages: Array.from({ length: pageCount }, (_, i) => ({ number: i + 1, isCurrent: i + 1 === current })),
      rangeFrom: total ? (size ? (current - 1) * size + 1 : 1) : 0, rangeTo: size ? Math.min(current * size, total) : total,
    },
  };
}
