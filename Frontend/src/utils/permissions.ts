import { UserRole, Permission, ROLE_PERMISSIONS } from '../constants/roles';

export const hasPermission = (role: UserRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

export const hasAnyPermission = (role: UserRole | undefined, permissions: Permission[]): boolean => {
  if (!role) return false;
  return permissions.some(p => hasPermission(role, p));
};

export const canAccessMenu = (role: UserRole | undefined, menuId: string): boolean => {
  if (!role) return false;
  if (role === 'Super Admin') return true;

  switch (menuId) {
    case 'dashboard':
      return true;
    case 'inventory':
      return ['Admin', 'Warehouse Director', 'Warehouse Entry Person'].includes(role);
    case 'receiving':
      return ['Warehouse Director'].includes(role);
    case 'procurement':
      return ['Procurement Director', 'Admin'].includes(role);
    case 'requests':
      return ['Admin', 'Requester', 'Request Confirmer'].includes(role);
    case 'forms':
      return ['Super Admin', 'Admin', 'Procurement Director'].includes(role);
    case 'notifications':
      return ['Super Admin', 'Admin', 'Procurement Director', 'Warehouse Director'].includes(role);
    case 'reports':
      return ['Admin', 'Super Admin'].includes(role);
    case 'settings':
      return ['Super Admin'].includes(role);
    case 'trash':
      return ['Super Admin'].includes(role);
    case 'audit':
      return ['Super Admin'].includes(role);
    case 'role_management':
      return ['Super Admin'].includes(role);
    case 'user_management':
      return ['Super Admin'].includes(role);
    case 'traceability':
      return ['Admin', 'Warehouse Director', 'Warehouse Entry Person'].includes(role);
    case 'superadmin_home':
    case 'superadmin_inventory':
    case 'superadmin_requests':
    case 'superadmin_procurement':
    case 'superadmin_receiving':
      return false;
    case 'about_us':
      return true;
    default:
      return false;
  }
};
