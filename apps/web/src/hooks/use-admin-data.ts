import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Brand, CategoryNode, Page } from '@/lib/admin-types';

export function useAdminBrands(search: string = '') {
  return useQuery({
    queryKey: ['admin', 'brands', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('pageSize', '50');
      const res = await apiFetch<Page<Brand>>(`/admin/brands?${params}`);
      if (!res.ok || !res.data) throw new Error(res.error || 'Failed to fetch brands');
      return res.data;
    },
    staleTime: Infinity, // 0ms latency for repetitive brand listing calls
  });
}

export function useDeleteAdminBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/admin/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.error || 'Failed to archive brand');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const res = await apiFetch<CategoryNode[]>('/admin/categories');
      if (!res.ok || !res.data) throw new Error(res.error || 'Failed to fetch categories');
      return res.data;
    },
    staleTime: Infinity, // 0ms latency for repetitive category tree calls
  });
}
