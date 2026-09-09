import { describe, expect, it } from 'vitest';
import {
  ACCESS_MODULES,
  canonicalizeBinaryModuleAccessRights,
  hasPageAccess,
  expandAccessModule,
  getAccessModuleState,
  hasBinaryModulePageAccess,
  toggleAccessModule,
} from '../accessModules';

describe('access module permissions', () => {
  it('exposes the six top-nav module families', () => {
    expect(ACCESS_MODULES.map((module) => module.id)).toEqual([
      'home',
      'warehouse',
      'sales',
      'accounting',
      'maintenance',
      'communication',
    ]);
  });

  it('expands a module toggle to every page in its top-nav family', () => {
    expect(expandAccessModule('sales')).toEqual([
      'sales-transaction-sales-inquiry',
      'sales-transaction-sales-order',
      'sales-transaction-order-slip',
      'sales-transaction-invoice',
      'sales-transaction-daily-call-monitoring',
      'sales-reports-inquiry-report',
      'sales-reports-sales-report',
      'sales-reports-sales-development-report',
      'sales-reports-sales-map',
    ]);
  });

  it('marks a module indeterminate when only some pages are granted', () => {
    const salesPages = expandAccessModule('sales');

    expect(getAccessModuleState('sales', salesPages)).toEqual({ checked: true, indeterminate: false });
    expect(getAccessModuleState('sales', salesPages.slice(0, -1))).toEqual({ checked: false, indeterminate: true });
    expect(getAccessModuleState('sales', [])).toEqual({ checked: false, indeterminate: false });
  });

  it('preserves partial page grants and gates at the page boundary', () => {
    const partial = [
      ...expandAccessModule('home'),
      'sales-transaction-sales-inquiry',
      'maintenance-customer-customer-data',
    ];

    expect(canonicalizeBinaryModuleAccessRights(partial)).toEqual(partial);
    expect(hasPageAccess(partial, 'sales-transaction-sales-inquiry')).toBe(true);
    expect(hasPageAccess(partial, 'sales-transaction-sales-order')).toBe(false);
  });

  it('uses navigated routes for pages whose menu id is only a display key', () => {
    expect(expandAccessModule('communication')).toContain('sales-transaction-marketing-campaigns');
  });

  it.each(ACCESS_MODULES)('toggles every page in the %s module as one binary permission', (module) => {
    const enabled = toggleAccessModule([], module.id, true);
    expect(enabled).toEqual(module.pageIds);
    expect(getAccessModuleState(module.id, enabled)).toEqual({ checked: true, indeterminate: false });

    const disabled = toggleAccessModule(enabled, module.id, false);
    expect(disabled).toEqual([]);
    expect(getAccessModuleState(module.id, disabled)).toEqual({ checked: false, indeterminate: false });
  });
});
