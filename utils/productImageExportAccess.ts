import { canonicalizeRoleName, isMasterUserAccount, ROLE_NAMES } from '../constants';
import type { UserProfile } from '../types';

export const isSalesAgentUser = (user: UserProfile | null): boolean =>
  !isMasterUserAccount(user) && (canonicalizeRoleName(user?.role) === ROLE_NAMES.SALES_AGENT || String(user?.user_type ?? '') === '2');

export const canExportProductImages = (user: UserProfile | null, assignedAgentId?: string): boolean => {
  if (!user?.id) return false;
  if (isMasterUserAccount(user)) return true;
  if (!isSalesAgentUser(user)) return true;
  return Boolean(assignedAgentId) && String(user.id) === String(assignedAgentId);
};
