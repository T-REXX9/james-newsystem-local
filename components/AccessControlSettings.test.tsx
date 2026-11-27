import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AccessControlSettings from './AccessControlSettings';
import { fetchProfilesLocal, updateProfileLocal } from '../services/accessLocalApiService';
import { fetchAccessGroups } from '../services/accessGroupApiService';
import { ToastProvider } from './ToastProvider';
import { ACCESS_MODULES, expandAccessModule } from '../utils/accessModules';
import { getLocalAuthSession } from '../services/localAuthService';

vi.mock('../services/accessLocalApiService', () => ({
  fetchProfilesLocal: vi.fn(),
  updateProfileLocal: vi.fn(),
}));

vi.mock('../services/localAuthService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/localAuthService')>();
  return { ...actual, getLocalAuthSession: vi.fn() };
});

vi.mock('../services/accessGroupApiService', () => ({
  fetchAccessGroups: vi.fn(),
  createAccessGroup: vi.fn(),
  updateAccessGroup: vi.fn(),
  deleteAccessGroup: vi.fn(),
  assignStaffToGroup: vi.fn(),
}));


const fetchProfilesMock = fetchProfilesLocal as unknown as ReturnType<typeof vi.fn>;
const updateProfileMock = updateProfileLocal as unknown as ReturnType<typeof vi.fn>;
const fetchAccessGroupsMock = fetchAccessGroups as unknown as ReturnType<typeof vi.fn>;

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLocalAuthSession).mockReturnValue({ userProfile: { user_type: 1 } } as any);
  fetchProfilesMock.mockResolvedValue({
    items: [],
    meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
  });
  fetchAccessGroupsMock.mockResolvedValue([
    { id: '2', name: 'Sales Agent', access_rights: [], description: '' },
    { id: '3', name: 'Accountant', access_rights: [], description: '' },
    { id: '4', name: 'Warehouse Personnel', access_rights: [], description: '' },
    { id: '9', name: 'Company Owner', access_rights: [], description: '' },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('AccessControlSettings - access control and permissions', () => {
  it('saves edited staff permissions through the profile update API', async () => {
    const user = userEvent.setup();
    const homePages = expandAccessModule('home');
    fetchProfilesMock.mockResolvedValue({
      items: [
        {
          id: '2',
          full_name: 'melson',
          email: 'melson@example.com',
          role: 'Sales Agent',
          access_rights: homePages,
          access_override: false,
          group_id: '2',
        },
      ],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({
      id: '2',
      full_name: 'melson',
      email: 'melson@example.com',
      role: 'Sales Agent',
      groupId: '2',
      access_rights: [...homePages, ...expandAccessModule('warehouse')],
      access_override: true,
      group_id: '9',
    });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByRole('checkbox', { name: 'Warehouse module access for melson' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith('2', {
        group_id: '2',
        access_rights: [...homePages, ...expandAccessModule('warehouse')],
        access_override: true,
      })
    );
  });

  it('saves Sales Development Report page access for an individual account', async () => {
    const user = userEvent.setup();
    const homePages = expandAccessModule('home');
    fetchProfilesMock.mockResolvedValue({
      items: [{
        id: '2',
        full_name: 'melson',
        email: 'melson@example.com',
        role: 'Sales Agent',
        access_rights: homePages,
        access_override: false,
        group_id: '2',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({ id: '2', full_name: 'melson' });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByText('Sales', { selector: 'span' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sales Development Report page access for melson' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith('2', expect.objectContaining({
      access_rights: [...homePages, 'sales-reports-sales-development-report'],
      access_override: true,
    })));
  });

  it('saves Edit invoice number for Invoice when that is the only action toggled', async () => {
    const user = userEvent.setup();
    const salesPages = expandAccessModule('sales');
    fetchProfilesMock.mockResolvedValue({
      items: [{
        id: '2',
        full_name: 'melson',
        email: 'melson@example.com',
        role: 'Sales Agent',
        access_rights: salesPages,
        group_id: '2',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({ id: '2', full_name: 'melson' });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByText('Sales', { selector: 'span' }));
    await user.click(screen.getByRole('checkbox', { name: 'Edit invoice number action permission for Invoice for melson' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith('2', expect.objectContaining({
      action_permissions: expect.objectContaining({
        pages: expect.objectContaining({
          Invoice: expect.objectContaining({
            can_edit_invoice_number: true,
          }),
        }),
      }),
    })));
  });

  it('persists Edit unit price onto Sales Inquiry when the account override lacked that page', async () => {
    const user = userEvent.setup();
    const salesPages = expandAccessModule('sales');
    fetchProfilesMock.mockResolvedValue({
      items: [{
        id: '64',
        full_name: 'test',
        email: 'test@gmail.com',
        role: 'Sales Agent',
        access_rights: salesPages,
        group_id: '9',
        action_permissions: {
          global: {
            can_view: true,
            can_approve: true,
            can_add: true,
            can_edit: true,
            can_delete: true,
            can_post: true,
            can_unpost: true,
            can_edit_invoice_number: false,
            can_edit_unit_price: false,
          },
          pages: {
            Invoice: {
              can_view: true,
              can_approve: true,
              can_add: true,
              can_edit: true,
              can_delete: true,
              can_post: true,
              can_unpost: true,
              can_edit_invoice_number: true,
              can_edit_unit_price: false,
            },
          },
        },
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({ id: '64', full_name: 'test' });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByText('Sales', { selector: 'span' }));
    const editUnitPrice = await screen.findByRole('checkbox', {
      name: 'Edit unit price action permission for Sales Inquiry for test',
    });
    expect(editUnitPrice).not.toBeChecked();
    await user.click(editUnitPrice);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith('64', expect.objectContaining({
      action_permissions: expect.objectContaining({
        pages: expect.objectContaining({
          'Sales Inquiry': expect.objectContaining({
            can_edit_unit_price: true,
          }),
        }),
      }),
    })));
  });

  it('saves disabled action permissions for one page without changing another page', async () => {
    const user = userEvent.setup();
    fetchProfilesMock.mockResolvedValue({
      items: [{
        id: '2',
        full_name: 'melson',
        email: 'melson@example.com',
        role: 'Sales Agent',
        access_rights: expandAccessModule('home'),
        group_id: '2',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({ id: '2', full_name: 'melson' });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByText('Sales', { selector: 'span' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Sales Inquiry page access for melson' }));
    await user.click(screen.getByRole('checkbox', { name: 'View action permission for Sales Inquiry for melson' }));
    await user.click(screen.getByRole('checkbox', { name: 'Edit action permission for Sales Inquiry for melson' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith('2', expect.objectContaining({
      action_permissions: {
        global: {
          can_view: true,
          can_approve: true,
          can_add: true,
          can_edit: true,
          can_delete: true,
          can_post: true,
          can_unpost: true,
          can_edit_invoice_number: false,
          can_edit_unit_price: false,
          can_view_all_records: false,
        },
        pages: {
          'Sales Inquiry': {
            can_view: false,
            can_approve: true,
            can_add: true,
            can_edit: false,
            can_delete: true,
            can_post: true,
            can_unpost: true,
            can_edit_invoice_number: false,
            can_edit_unit_price: false,
            can_view_all_records: false,
          },
        },
      },
    })));
  });

  it('persists account-wide Backdated posting on Save', async () => {
    const user = userEvent.setup();
    const salesPages = expandAccessModule('sales');
    fetchProfilesMock.mockResolvedValue({
      items: [{
        id: '2',
        full_name: 'melson',
        email: 'melson@example.com',
        role: 'Sales Agent',
        access_rights: salesPages,
        group_id: '2',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    updateProfileMock.mockResolvedValue({ id: '2', full_name: 'melson' });

    renderWithProviders(<AccessControlSettings />);

    await user.click(await screen.findByRole('checkbox', { name: 'Backdated posting for melson' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith('2', expect.objectContaining({
      action_permissions: expect.objectContaining({
        can_backdate: true,
      }),
    })));
  });

  it('persists all six module toggles as complete page sets after reload', async () => {
    const user = userEvent.setup();
    let persistedRights: string[] = [];
    const profile = {
      id: '2',
      full_name: 'melson',
      email: 'melson@example.com',
      role: 'Sales Agent',
      access_override: false,
      group_id: '2',
    };
    fetchProfilesMock.mockImplementation(async () => ({
      items: [{ ...profile, access_rights: persistedRights }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    }));
    updateProfileMock.mockImplementation(async (_staffId, data) => {
      persistedRights = data.access_rights || [];
      return { ...profile, access_rights: persistedRights, access_override: true };
    });

    renderWithProviders(<AccessControlSettings />);

    for (const module of ACCESS_MODULES) {
      await user.click(await screen.findByRole('checkbox', {
        name: `${module.label} module access for melson`,
      }));
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
    expect(persistedRights).toEqual(ACCESS_MODULES.flatMap((module) => module.pageIds));

    cleanup();
    renderWithProviders(<AccessControlSettings />);
    for (const module of ACCESS_MODULES) {
      expect(await screen.findByRole('checkbox', {
        name: `${module.label} module access for melson`,
      })).toBeChecked();
    }
  });

  it('does not expose staff account creation on the System Access page', async () => {
    renderWithProviders(<AccessControlSettings />);

    await screen.findByText('Showing 0-0 of 0 staff members');

    expect(screen.queryByRole('button', { name: /Add New Account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Account/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Create Staff Account')).not.toBeInTheDocument();
  });

});
