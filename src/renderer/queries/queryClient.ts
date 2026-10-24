import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Don't refetch on window focus (Electron)
      refetchOnWindowFocus: false,
      // Retry once on error
      retry: 1,
    },
  },
});
