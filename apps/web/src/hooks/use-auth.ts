import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, AuthSummary, CurrentUser, setStoredToken } from '@/lib/api';

export const AUTH_QUERY_KEY = ['auth', 'me'];

export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch<CurrentUser>('/auth/me');
      if (res.status === 401 || res.status === 403) {
        setStoredToken(null);
        return null;
      }
      if (!res.ok) throw new Error(res.error || 'Failed to fetch current user');
      return res.data;
    },
    staleTime: 1000 * 60, // 1 minute stale time so session updates rapidly across navigations
    enabled: options?.enabled ?? true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string; totpCode?: string }) => {
      const res = await apiFetch<AuthSummary>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw res;
      if (res.data?.accessToken) {
        setStoredToken(res.data.accessToken);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/auth/logout', { method: 'POST' });
      setStoredToken(null);
      if (!res.ok) throw new Error(res.error || 'Logout failed');
      return res;
    },
    onSuccess: () => {
      setStoredToken(null);
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}

