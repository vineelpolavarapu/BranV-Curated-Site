import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, CurrentUser } from '@/lib/api';

export const AUTH_QUERY_KEY = ['auth', 'me'];

export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch<CurrentUser>('/auth/me');
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error(res.error || 'Failed to fetch current user');
      return res.data;
    },
    staleTime: Infinity, // 0ms latency for repetitive session queries
    enabled: options?.enabled ?? true,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error(res.error || 'Logout failed');
      return res;
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries();
    },
  });
}
