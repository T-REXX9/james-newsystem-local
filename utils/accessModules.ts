import { TOPBAR_MENU_CONFIG } from './topbarMenuConfig';

export interface AccessModule {
  id: string;
  label: string;
  pageIds: string[];
}

const moduleIds = ['home', 'warehouse', 'sales', 'accounting', 'maintenance', 'communication'] as const;

const pageIdsForMenu = (menuId: string): string[] => {
  const menu = TOPBAR_MENU_CONFIG.find((candidate) => candidate.id === menuId);
  if (!menu) return [];

  // App.tsx checks the navigated route, which is not always the same as the
  // menu item's stable configuration id (for example SMS Blasting).
  return (menu.submenus || []).flatMap((submenu) => submenu.items.map((item) => item.route));
};

export const ACCESS_MODULES: AccessModule[] = moduleIds.map((id) => ({
  id,
  label: id === 'home' ? 'Dashboards' : id.charAt(0).toUpperCase() + id.slice(1),
  pageIds: pageIdsForMenu(id),
}));

const moduleById = new Map(ACCESS_MODULES.map((module) => [module.id, module]));

export const expandAccessModule = (moduleId: string): string[] => moduleById.get(moduleId)?.pageIds || [];

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
