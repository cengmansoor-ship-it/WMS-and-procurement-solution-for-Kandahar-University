import { apiClient } from '../api/apiClient';

export const traceabilityService = {
  getSummary: () => apiClient.get('/traceability/summary'),
  getAdminDepartments: () => apiClient.get('/traceability/admin'),
  getFacultyLevels: () => apiClient.get('/traceability/faculties/levels'),
  getDepartmentsByLevel: (level: string) => apiClient.get(`/traceability/faculties/levels/${encodeURIComponent(level)}`),
  getPersonsByDepartment: (deptId: number) => apiClient.get(`/traceability/departments/${deptId}/persons`),
  getPersonsByFaculty: (facultyId: number) => apiClient.get(`/traceability/faculties/${facultyId}/persons`),
  getPersonLedger: (personId: number) => apiClient.get(`/traceability/person/${personId}/ledger`),
  searchAssignments: (term: string) => apiClient.get(`/traceability/search?q=${encodeURIComponent(term)}`),
  getExportData: (filters?: Record<string, string>) => {
    const q = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiClient.get(`/traceability/export${q}`);
  },
  manualAssignment: (data: Record<string, any>) => apiClient.post('/traceability/manual-assignment', data),
};
