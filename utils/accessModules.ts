import { TOPBAR_MENU_CONFIG } from './topbarMenuConfig';
import type { ActionPermissionName } from '../constants';

export interface AccessModule {
  id: string;
  label: string;
  pages: AccessPage[];
  pageIds: string[];
}

export interface AccessPage {
  id: string;
  label: string;
  supportedActions?: ActionPermissionName[];
}

const READ_ONLY_ROUTE_PARTS = ['report', 'dashboard', 'audit', 'activity-logs', 'call-records', 'sales-map', 'recycle-bin'];
const supportedActionsForPage = (pageId: string): ActionPermissionName[] => {
  if (READ_ONLY_ROUTE_PARTS.some((part) => pageId.includes(part))) return [];
  const actions: ActionPermissionName[] = ['can_view', 'can_approve', 'can_add', 'can_edit', 'can_delete', 'can_post', 'can_unpost'];
  if (pageId === 'sales-transaction-invoice') {
    actions.push('can_edit_invoice_number');
  }
  if (pageId === 'sales-transaction-sales-inquiry') {
    actions.push('can_edit_unit_price');
  }
  return actions;
};

const moduleIds = ['home', 'warehouse', 'sales', 'accounting', 'maintenance', 'communication'] as const;

const pageIdsForMenu = (menuId: string): string[] => {
  const menu = TOPBAR_MENU_CONFIG.find((candidate) => candidate.id === menuId);
  if (!menu) return [];

  // App.tsx checks the navigated route, which is not always the same as the
  // menu item's stable configuration id (for example SMS Blasting).
  // Master-only pages are role-gated, not granted via Access Control checkboxes.
  return (menu.submenus || []).flatMap((submenu) =>
    submenu.items.filter((item) => !item.masterOnly).map((item) => item.route)
  );
};

const pagesForMenu = (menuId: string): AccessPage[] => {
  const menu = TOPBAR_MENU_CONFIG.find((candidate) => candidate.id === menuId);
  if (!menu) return [];

  return (menu.submenus || []).flatMap((submenu) =>
    submenu.items
      .filter((item) => !item.masterOnly)
      .map((item) => ({ id: item.route, label: item.label, supportedActions: supportedActionsForPage(item.route) }))
  );
};

export const ACCESS_MODULES: AccessModule[] = moduleIds.map((id) => ({
  id,
  label: id === 'home' ? 'Dashboards' : id.charAt(0).toUpperCase() + id.slice(1),
  pages: pagesForMenu(id),
  pageIds: pageIdsForMenu(id),
}));

const moduleById = new Map(ACCESS_MODULES.map((module) => [module.id, module]));

export const expandAccessModule = (moduleId: string): string[] => moduleById.get(moduleId)?.pageIds || [];

export const getAccessPageLabel = (pageId: string): string | undefined => {
  for (const module of ACCESS_MODULES) {
    const page = module.pages.find((candidate) => candidate.id === pageId);
    if (page) return page.label;
  }
  return undefined;
};

export const getAccessModuleState = (
  moduleId: string,
  grantedPageIds: Iterable<string>
): { checked: boolean; indeterminate: boolean } => {
  const pageIds = expandAccessModule(moduleId);
  const granted = new Set(grantedPageIds);
  if (granted.has('*')) return { checked: true, indeterminate: false };
  const grantedCount = pageIds.filter((pageId) => granted.has(pageId)).length;
  return {
    checked: pageIds.length > 0 && grantedCount === pageIds.length,
    indeterminate: grantedCount > 0 && grantedCount < pageIds.length,
  };
};

export const toggleAccessPage = (
  grantedPageIds: Iterable<string>,
  pageId: string,
  enabled: boolean
): string[] => {
  const rights = new Set(grantedPageIds);
  rights.delete('*');
  if (enabled) rights.add(pageId);
  else rights.delete(pageId);
  return Array.from(rights);
};

export const toggleAccessModule = (
  grantedPageIds: Iterable<string>,
  moduleId: string,
  enabled: boolean
): string[] => {
  const pageIds = new Set(grantedPageIds);
  if (pageIds.has('*')) {
    if (enabled) return Array.from(pageIds);
    pageIds.delete('*');
    ACCESS_MODULES.flatMap((module) => module.pageIds).forEach((pageId) => pageIds.add(pageId));
  }
  expandAccessModule(moduleId).forEach((pageId) => {
    if (enabled) pageIds.add(pageId);
    else pageIds.delete(pageId);
  });
  return Array.from(pageIds);
};

export const canonicalizeAccessRights = (grantedPageIds: Iterable<string>): string[] => {
  const granted = new Set(Array.from(grantedPageIds).filter((id): id is string => typeof id === 'string'));
  if (granted.has('*')) return ['*'];
  return Array.from(granted);
};

/** @deprecated Kept for callers outside the new page-level access flow. */
export const canonicalizeBinaryModuleAccessRights = canonicalizeAccessRights;

export const hasPageAccess = (
  grantedPageIds: Iterable<string>,
  pageId: string
): boolean => {
  const granted = new Set(Array.from(grantedPageIds).filter((id): id is string => typeof id === 'string'));
  if (granted.has('*')) return true;
  const containingModule = ACCESS_MODULES.find((module) => module.pageIds.includes(pageId));
  if (containingModule && granted.has(containingModule.id)) return true;
  return granted.has(pageId);
};

/** @deprecated Use hasPageAccess for page-level grants. */
export const hasBinaryModulePageAccess = hasPageAccess;
