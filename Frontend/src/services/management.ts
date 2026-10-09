import { apiClient } from '../api/apiClient';

export const managementService = {
  // Faculties
  getFaculties: () => apiClient.get('/management/faculties'),
  createFaculty: (data: any) => apiClient.post('/management/faculties', data),
  updateFaculty: (id: number, data: any) => apiClient.put(`/management/faculties/${id}`, data),
  deleteFaculty: (id: number, reason?: string, deletedByName?: string) =>
    apiClient.deleteWithBody(`/management/faculties/${id}`, { delete_reason: reason || null, deleted_by_name: deletedByName || null }),

  // Departments
  getDepartments: () => apiClient.get('/management/departments'),
  createDepartment: (data: any) => apiClient.post('/management/departments', data),
  updateDepartment: (id: number, data: any) => apiClient.put(`/management/departments/${id}`, data),
  deleteDepartment: (id: number, reason?: string, deletedByName?: string) =>
    apiClient.deleteWithBody(`/management/departments/${id}`, { delete_reason: reason || null, deleted_by_name: deletedByName || null }),

  // People
  getPeople: (departmentId?: number) => {
    const q = departmentId ? `?department_id=${departmentId}` : '';
    return apiClient.get(`/management/people${q}`);
  },
  getPersonById: (id: number) => apiClient.get(`/management/people/${id}`),
  createPerson: (data: any) => apiClient.post('/management/people', data),
  updatePerson: (id: number, data: any) => apiClient.put(`/management/people/${id}`, data),
  deletePerson: (id: number, reason?: string, deletedByName?: string) =>
    apiClient.deleteWithBody(`/management/people/${id}`, { delete_reason: reason || null, deleted_by_name: deletedByName || null }),
  importPeople: (rows: any[]) => apiClient.post('/management/people/import', { rows }),

  // Assignments
  getAssignments: (filters?: { person_id?: number; department_id?: number; faculty_id?: number }) => {
    const q = filters ? '?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return apiClient.get(`/management/assignments${q}`);
  },
  updateAssignment: (id: number, data: { status: string; notes?: string }) => apiClient.put(`/management/assignments/${id}`, data),
  deleteAssignment: (id: number) => apiClient.delete(`/management/assignments/${id}`),

  // Email
  sendEmail: (data: { to: string; subject: string; body: string }) => apiClient.post('/email/send', data),
};
