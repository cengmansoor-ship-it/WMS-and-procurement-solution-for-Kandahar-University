import { apiClient } from '../api/apiClient';

export interface BudgetBab {
  id: number;
  bab_code: string;
  name_ps: string;
  name_fa: string;
  description?: string;
}

export interface BudgetFasl {
  id: number;
  bab_id: number;
  fasl_code: string;
  name_ps: string;
  name_fa: string;
  bab_code?: string;
  bab_name_ps?: string;
  description?: string;
}

export const budgetService = {
  getBabs: async (): Promise<BudgetBab[]> => {
    try {
      const data: BudgetBab[] = await apiClient.get('/budget/babs');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  getBabById: async (id: number): Promise<BudgetBab | null> => {
    try {
      return await apiClient.get(`/budget/babs/${id}`);
    } catch {
      return null;
    }
  },

  getFaslsByBab: async (babId: number): Promise<BudgetFasl[]> => {
    try {
      const data: BudgetFasl[] = await apiClient.get(`/budget/babs/${babId}/fasls`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  getAllFasls: async (): Promise<BudgetFasl[]> => {
    try {
      const data: BudgetFasl[] = await apiClient.get('/budget/fasls');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  search: async (q: string): Promise<{ babs: BudgetBab[]; fasls: BudgetFasl[] }> => {
    try {
      return await apiClient.get(`/budget/search?q=${encodeURIComponent(q)}`);
    } catch {
      return { babs: [], fasls: [] };
    }
  },

  import: (babs: Omit<BudgetBab, 'id'>[], fasls: any[]) =>
    apiClient.post('/budget/import', { babs, fasls }),

  createBab: async (data: { bab_code: string; name_ps: string; name_fa: string; description?: string }): Promise<BudgetBab> => {
    return await apiClient.post('/budget/babs', data);
  },

  createFasl: async (data: { bab_id: number; fasl_code: string; name_ps: string; name_fa: string; description?: string }): Promise<BudgetFasl> => {
    return await apiClient.post('/budget/fasls', data);
  },

  updateBab: async (id: number, data: { bab_code?: string; name_ps?: string; name_fa?: string; description?: string }): Promise<BudgetBab> => {
    return await apiClient.put(`/budget/babs/${id}`, data);
  },

  updateFasl: async (id: number, data: { fasl_code?: string; name_ps?: string; name_fa?: string; description?: string }): Promise<BudgetFasl> => {
    return await apiClient.put(`/budget/fasls/${id}`, data);
  },

  deleteBab: async (id: number): Promise<void> => {
    await apiClient.delete(`/budget/babs/${id}`);
  },

  deleteFasl: async (id: number): Promise<void> => {
    await apiClient.delete(`/budget/fasls/${id}`);
  },
};
