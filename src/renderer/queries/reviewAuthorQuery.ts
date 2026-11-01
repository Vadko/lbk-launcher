import { queryOptions } from '@tanstack/react-query';
import { fetchReviewAuthor } from './reviewsClient';

// A claimed nickname never changes, so it is kept for the session; a claim or author_required invalidates it
export const reviewAuthorQuery = queryOptions({
  queryKey: ['review-author'],
  queryFn: async () => {
    const known = await fetchReviewAuthor();
    if (!known.ok) {
      throw new Error(`Review author lookup failed: ${known.failure.code}`);
    }
    return known.data;
  },
  // Without a nickname the picker opens on the spins the server allows now, so that answer is asked again
  staleTime: ({ state }) => (state.data?.author ? Infinity : 0),
  gcTime: Infinity,
  // Main answers an unreachable server as a failure, which a paused lookup would hide from the waiting write
  networkMode: 'always',
  // The picker covers a failed lookup: its spin answers author_exists when a nickname is there
  retry: false,
});
