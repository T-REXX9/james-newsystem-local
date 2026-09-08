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
  // Master-only pages are role-gated, not granted via Access Control checkboxes.
  return (menu.submenus || []).flatMap((submenu) =>
    submenu.items.filter((item) => !item.masterOnly).map((item) => item.route)
  );
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
): { checked: boolean; indeterminate: false } => {
  const pageIds = expandAccessModule(moduleId);
  const granted = new Set(grantedPageIds);
  if (granted.has('*')) return { checked: true, indeterminate: false };
  const checked = pageIds.length > 0 && pageIds.every((pageId) => granted.has(pageId));

  // Module permissions are intentionally binary. Legacy partial page grants
  // are shown as unchecked until the user enables the complete module.
  return { checked, indeterminate: false };
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

/**
 * Drop leftover page grants that belong to modules which are not fully checked.
 * Access Control treats modules as binary; partial/legacy grants otherwise leave
 * Sales/Maintenance visible while those checkboxes look unchecked.
 */
export const canonicalizeBinaryModuleAccessRights = (grantedPageIds: Iterable<string>): string[] => {
  const granted = new Set(Array.from(grantedPageIds).filter((id): id is string => typeof id === 'string'));
  if (granted.has('*')) return ['*'];

  const kept = new Set<string>();
  ACCESS_MODULES.forEach((module) => {
    if (!getAccessModuleState(module.id, granted).checked) return;
    module.pageIds.forEach((pageId) => kept.add(pageId));
  });
  return Array.from(kept);
};

const pageIdToModuleId = (() => {
  const map = new Map<string, string>();
  ACCESS_MODULES.forEach((module) => {
    module.pageIds.forEach((pageId) => map.set(pageId, module.id));
  });
  return map;
})();

/** Page access follows binary module checkboxes, not leftover partial page grants. */
export const hasBinaryModulePageAccess = (
  grantedPageIds: Iterable<string>,
  pageId: string
): boolean => {
  const granted = new Set(Array.from(grantedPageIds).filter((id): id is string => typeof id === 'string'));
  if (granted.has('*')) return true;

  const moduleId = pageIdToModuleId.get(pageId);
  if (!moduleId) {
    return granted.has(pageId);
  }

  return getAccessModuleState(moduleId, granted).checked;
};
