import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AccessControlSettings from './AccessControlSettings';
import { createStaffAccountLocal, fetchProfilesLocal, updateProfileLocal } from '../services/accessLocalApiService';
import { fetchAccessGroups } from '../services/accessGroupApiService';
import { ROLE_DEFAULT_ACCESS_RIGHTS } from '../constants';
import { ToastProvider } from './ToastProvider';
import { ACCESS_MODULES, expandAccessModule } from '../utils/accessModules';

vi.mock('../services/accessLocalApiService', () => ({
  fetchProfilesLocal: vi.fn(),
  updateProfileLocal: vi.fn(),
  createStaffAccountLocal: vi.fn(),
}));

vi.mock('../services/accessGroupApiService', () => ({
  fetchAccessGroups: vi.fn(),
  createAccessGroup: vi.fn(),
  updateAccessGroup: vi.fn(),
  deleteAccessGroup: vi.fn(),
  assignStaffToGroup: vi.fn(),
}));


const fetchProfilesMock = fetchProfilesLocal as unknown as ReturnType<typeof vi.fn>;
const createStaffAccountMock = createStaffAccountLocal as unknown as ReturnType<typeof vi.fn>;
const updateProfileMock = updateProfileLocal as unknown as ReturnType<typeof vi.fn>;
const fetchAccessGroupsMock = fetchAccessGroups as unknown as ReturnType<typeof vi.fn>;

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.resetAllMocks();
  fetchProfilesMock.mockResolvedValue({
    items: [],
    meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
  });
  fetchAccessGroupsMock.mockResolvedValue([]);
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

describe('AccessControlSettings - create staff account', () => {
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

  it('creates a staff account and refreshes profiles on success', async () => {
    const user = userEvent.setup();
    const refreshedProfiles = [{ id: '1', full_name: 'Owner', email: 'owner@example.com', role: 'Owner', access_rights: ['*'] }];
    fetchProfilesMock
      .mockResolvedValueOnce({
        items: [],
        meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
      })
      .mockResolvedValueOnce({
        items: refreshedProfiles,
        meta: { page: 1, per_page: 50, total: refreshedProfiles.length, total_pages: 1 },
      });
    createStaffAccountMock.mockResolvedValue({ success: true, userId: 'new-user' });

    renderWithProviders(<AccessControlSettings />);

    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'Jane Doe');
    await user.selectOptions(screen.getByRole('combobox'), 'Sales Agent');
    await user.type(screen.getByPlaceholderText('staff@company.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('0917...'), '09171234567');
    await user.type(screen.getByPlaceholderText('Set initial password'), 'StrongPass1');

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(createStaffAccountMock).toHaveBeenCalledTimes(1));
    expect(createStaffAccountMock).toHaveBeenCalledWith({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass1',
      role: 'Sales Agent',
      groupId: '2',
      birthday: undefined,
      mobile: '09171234567',
      accessRights: ROLE_DEFAULT_ACCESS_RIGHTS['Sales Agent']
    });

    await waitFor(() => expect(fetchProfilesMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Create Staff Account')).not.toBeInTheDocument());
    expect(screen.getByText(/Account created for Jane Doe/i)).toBeInTheDocument();
  }, 10000);

  it('shows client-side validation errors and does not call the service', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccessControlSettings />);

    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'Jane Doe');
    await user.type(screen.getByPlaceholderText('staff@company.com'), 'invalid-email');
    await user.type(screen.getByPlaceholderText('Set initial password'), 'short');

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(screen.queryByText(/Password must be at least/i)).not.toBeInTheDocument();
    expect(createStaffAccountMock).not.toHaveBeenCalled();
  });

  it('renders every role from the Groups list in the create account role selector', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccessControlSettings />);

    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    const roleSelect = screen.getByRole('combobox');
    const optionLabels = Array.from(roleSelect.querySelectorAll('option')).map((option) => option.textContent);

    expect(optionLabels).toEqual(['Accountant', 'Company Owner', 'Sales Agent', 'Warehouse Personnel']);
  });

  it('keeps the modal open and renders field errors when service validation fails', async () => {
    const user = userEvent.setup();
    createStaffAccountMock.mockResolvedValue({
      success: false,
      error: 'Unable to create account. Please try again.',
      validationErrors: { password: 'Service-level password issue' }
    });

    renderWithProviders(<AccessControlSettings />);
    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'Jane Doe');
    await user.type(screen.getByPlaceholderText('staff@company.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Set initial password'), 'StrongPass1');

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect((await screen.findAllByText(/Unable to create account/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Service-level password issue/i)).toBeInTheDocument();
    expect(screen.getByText('Create Staff Account')).toBeInTheDocument();
  });

  it('displays service errors and allows retrying', async () => {
    const user = userEvent.setup();
    createStaffAccountMock.mockResolvedValue({
      success: false,
      error: 'An account with this email already exists.'
    });

    renderWithProviders(<AccessControlSettings />);
    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'Jane Doe');
    await user.type(screen.getByPlaceholderText('staff@company.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Set initial password'), 'StrongPass1');

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect((await screen.findAllByText(/already exists/i)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(screen.getByText('Create Staff Account')).toBeInTheDocument();
  });

  it('clears typed details when the modal is cancelled or closed', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AccessControlSettings />);

    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    const fullNameInput = screen.getByPlaceholderText('e.g. John Doe');
    const emailInput = screen.getByPlaceholderText('staff@company.com');
    const mobileInput = screen.getByPlaceholderText('0917...');
    const passwordInput = screen.getByPlaceholderText('Set initial password');

    await user.type(fullNameInput, 'Jane Doe');
    await user.type(emailInput, 'jane@example.com');
    await user.type(mobileInput, '09171234567');
    await user.type(passwordInput, 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Create Staff Account')).not.toBeInTheDocument();

    await user.click((await screen.findAllByText('Add New Account'))[0]);
    expect(screen.getByPlaceholderText('e.g. John Doe')).toHaveValue('');
    expect(screen.getByPlaceholderText('staff@company.com')).toHaveValue('');
    expect(screen.getByPlaceholderText('0917...')).toHaveValue('');
    expect(screen.getByPlaceholderText('Set initial password')).toHaveValue('');

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'John Smith');
    await user.click(screen.getByRole('button', { name: 'Close create staff modal' }));

    expect(screen.queryByText('Create Staff Account')).not.toBeInTheDocument();

    await user.click((await screen.findAllByText('Add New Account'))[0]);
    expect(screen.getByPlaceholderText('e.g. John Doe')).toHaveValue('');
  });
});
