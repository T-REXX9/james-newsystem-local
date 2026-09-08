import { describe, expect, it } from 'vitest';
import {
  ACCESS_MODULES,
  expandAccessModule,
  getAccessModuleState,
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

  it('reports a module checked only when all of its pages are granted', () => {
    const salesPages = expandAccessModule('sales');

    expect(getAccessModuleState('sales', salesPages)).toEqual({ checked: true, indeterminate: false });
    expect(getAccessModuleState('sales', salesPages.slice(0, -1))).toEqual({ checked: false, indeterminate: true });
    expect(getAccessModuleState('sales', [])).toEqual({ checked: false, indeterminate: false });
  });

  it('uses navigated routes for pages whose menu id is only a display key', () => {
    expect(expandAccessModule('communication')).toContain('sales-transaction-marketing-campaigns');
  });
});
