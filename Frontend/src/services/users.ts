import { apiClient } from "../api/apiClient";
import type { UserProfile } from "../firebase/firestore";

export type UserSavePayload = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  active?: boolean;
  password?: string;
  forcePasswordChange?: boolean;
  person_id?: number | null;
  faculty_id?: number | null;
  department_id?: number | null;
  auditUserId?: string | number | null;
  auditUserName?: string;
  auditUserRole?: string;
};

export const userService = {
  getUsers: (): Promise<UserProfile[]> => apiClient.get("/users"),
  getByEmail: (email: string): Promise<UserProfile> =>
    apiClient.get(`/users/by-email?email=${encodeURIComponent(email)}`),
  createUser: (data: UserSavePayload): Promise<UserProfile> =>
    apiClient.post("/users", data),
  updateUser: (uid: string | number, data: UserSavePayload): Promise<UserProfile> =>
    apiClient.put(`/users/${encodeURIComponent(String(uid))}`, data),
  setActive: (
    uid: string | number,
    active: boolean,
    audit?: Pick<UserSavePayload, "auditUserId" | "auditUserName" | "auditUserRole">
  ): Promise<UserProfile> =>
    apiClient.put(`/users/${encodeURIComponent(String(uid))}`, { active, ...(audit || {}) }),
  deleteUser: (uid: string | number, deleteReason: string): Promise<void> =>
    apiClient.deleteWithBody(`/users/${encodeURIComponent(String(uid))}`, { deleteReason }),
  login: (email: string, password: string): Promise<UserProfile> =>
    apiClient.post("/auth/login", { email, password }),
};
