import { hasActionPermission, type ActionPermissionName } from '../constants';
import { getLocalAuthSession } from '../services/localAuthService';
import { ACCESS_MODULES } from './accessModules';

const getCurrentPageLabel = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  for (const module of ACCESS_MODULES) {
    const page = module.pages.find((candidate) => candidate.id === route);
    if (page) return page.label;
  }
  return undefined;
};

export const canPerformAction = (action: ActionPermissionName, pageLabel?: string): boolean =>
  hasActionPermission(getLocalAuthSession()?.userProfile, action, pageLabel || getCurrentPageLabel());
