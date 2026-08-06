'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity, // Data remains perpetually fresh in browser memory -> TRUE 0ms latency!
            gcTime: 1000 * 60 * 60 * 24, // Retain unused query cache in memory for 24 hours
            refetchOnWindowFocus: false, // Never trigger background refetches when switching tabs
            refetchOnMount: false, // Never trigger background refetches on component remount
            refetchOnReconnect: false, // Never trigger background refetches on network reconnect
            retry: 1, // Retry failed network queries once
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
