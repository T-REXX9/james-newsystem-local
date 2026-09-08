import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TopbarNavigation from '../TopbarNavigation';
import {
  ACCESS_MODULES,
  canonicalizeBinaryModuleAccessRights,
  expandAccessModule,
  getAccessModuleState,
  hasBinaryModulePageAccess,
} from '../../utils/accessModules';

const staffWithPartialLegacyRights = {
  id: '64',
  email: 'staff@example.com',
  role: 'Sales Agent',
  user_type: '2',
  access_rights: [
    'home',
    'maintenance-customer-customer-data',
    'sales-transaction-invoice',
    'sales-transaction-sales-inquiry',
    'sales-transaction-sales-order',
    'sales-transaction-order-slip',
    'sales-transaction-daily-call-monitoring',
    'operations-management-dashboard',
    'sales-performance-management-dashboard',
    'call-records-dashboard',
  ],
};

describe('binary module access vs leftover page grants', () => {
  afterEach(cleanup);

  it('treats Access Control Dashboards as Daily Call Monitoring only', () => {
    expect(expandAccessModule('home')).toEqual(['home']);
  });

  it('hides Sales/Maintenance leftovers and master-only dashboards for staff', async () => {
    const checkboxState = Object.fromEntries(
      ACCESS_MODULES.map((module) => [
        module.id,
        getAccessModuleState(module.id, staffWithPartialLegacyRights.access_rights).checked,
      ])
    );
    expect(checkboxState.home).toBe(true);
    expect(checkboxState.sales).toBe(false);
    expect(checkboxState.maintenance).toBe(false);

    expect(hasBinaryModulePageAccess(staffWithPartialLegacyRights.access_rights, 'sales-transaction-sales-inquiry')).toBe(
      false
    );
    expect(canonicalizeBinaryModuleAccessRights(staffWithPartialLegacyRights.access_rights)).toEqual(['home']);

    const user = userEvent.setup();
    render(
      <TopbarNavigation activeTab="home" onNavigate={vi.fn()} user={staffWithPartialLegacyRights} />
    );

    await user.click(screen.getAllByRole('button', { name: 'Toggle navigation' })[0]);
    const compactMenu = document.querySelector('[data-responsive-nav="compact"]') as HTMLElement;

    expect(within(compactMenu).getByRole('button', { name: 'DASHBOARDS' })).toBeTruthy();
    expect(within(compactMenu).queryByRole('button', { name: 'SALES' })).toBeNull();
    expect(within(compactMenu).queryByRole('button', { name: 'MAINTENANCE' })).toBeNull();

    await user.click(within(compactMenu).getByRole('button', { name: 'DASHBOARDS' }));
    expect(within(compactMenu).getByRole('menuitem', { name: 'Daily Call Monitoring Dashboard' })).toBeTruthy();
    expect(within(compactMenu).queryByRole('menuitem', { name: 'Operations Dashboard' })).toBeNull();
    expect(within(compactMenu).queryByRole('menuitem', { name: 'Sales Performance Dashboard' })).toBeNull();
    expect(within(compactMenu).queryByRole('menuitem', { name: 'Call Records' })).toBeNull();
  });

  it('shows master-only dashboards for Master User accounts', async () => {
    const user = userEvent.setup();
    render(
      <TopbarNavigation
        activeTab="home"
        onNavigate={vi.fn()}
        user={{
          id: '1',
          email: 'owner@example.com',
          role: 'Company Owner',
          user_type: '1',
          access_rights: ['*'],
        }}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Toggle navigation' })[0]);
    const compactMenu = document.querySelector('[data-responsive-nav="compact"]') as HTMLElement;
    await user.click(within(compactMenu).getByRole('button', { name: 'DASHBOARDS' }));

    expect(within(compactMenu).getByRole('menuitem', { name: 'Daily Call Monitoring Dashboard' })).toBeTruthy();
    expect(within(compactMenu).getByRole('menuitem', { name: 'Operations Dashboard' })).toBeTruthy();
    expect(within(compactMenu).getByRole('menuitem', { name: 'Sales Performance Dashboard' })).toBeTruthy();
    expect(within(compactMenu).getByRole('menuitem', { name: 'Call Records' })).toBeTruthy();
  });
});
