import { USER_ROLE } from './auth.constants.js';

export function getRoleHome(role) {
  return { [USER_ROLE.SUPER_ADMIN]: '/super-admin', [USER_ROLE.ORGANIZATION_ADMIN]: '/admin', [USER_ROLE.CLIENT]: '/client' }[role] ?? '/login';
}
