import { publishDataChange } from '../utils/dataSync';

const API_BASE_URL = '/api';

export const apiClient = {
  get: async (path: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json();
      return data.success ? data.data : data;
    } catch (error) {
      console.error(`API GET Error (${path}):`, error);
      throw error;
    }
  },

  post: async (path: string, body: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json();
      publishDataChange(path, 'POST');
      return data.success ? data.data : data;
    } catch (error) {
      console.error(`API POST Error (${path}):`, error);
      throw error;
    }
  },

  put: async (path: string, body: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json();
      publishDataChange(path, 'PUT');
      return data.success ? data.data : data;
    } catch (error) {
      console.error(`API PUT Error (${path}):`, error);
      throw error;
    }
  },

  delete: async (path: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json();
      publishDataChange(path, 'DELETE');
      return data.success ? data.data : data;
    } catch (error) {
      console.error(`API DELETE Error (${path}):`, error);
      throw error;
    }
  },

  deleteWithBody: async (path: string, body: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json();
      publishDataChange(path, 'DELETE');
      return data.success ? data.data : data;
    } catch (error) {
      console.error(`API DELETE Error (${path}):`, error);
      throw error;
    }
  },
};
