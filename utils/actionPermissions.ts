import { hasActionPermission, type ActionPermissionName } from '../constants';
import { getLocalAuthSession } from '../services/localAuthService';

export const canPerformAction = (action: ActionPermissionName): boolean =>
  hasActionPermission(getLocalAuthSession()?.userProfile, action);
