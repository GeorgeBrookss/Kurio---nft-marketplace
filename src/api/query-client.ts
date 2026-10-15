import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => error instanceof ApiError && error.isTransient && count < 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
})
