import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Staff from '../Staff';
import { ToastProvider } from '../../../ToastProvider';
import { changeStaffPassword, createStaff, fetchStaff } from '../../../../services/staffLocalApiService';
import { fetchAccessGroups } from '../../../../services/accessGroupApiService';

vi.mock('../../../../services/staffLocalApiService', () => ({
  fetchStaff: vi.fn(),
  createStaff: vi.fn(),
  changeStaffPassword: vi.fn(),
  updateStaff: vi.fn(),
  deleteStaff: vi.fn(),
}));

vi.mock('../../../../services/accessGroupApiService', () => ({
  fetchAccessGroups: vi.fn(),
}));

vi.mock('../../../../services/teamLocalApiService', () => ({
  fetchTeams: vi.fn(async () => ({ items: [], meta: {} })),
}));

describe('Staff Management', () => {
  beforeEach(() => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'master-token',
      context: { user_type: '1', user: { id: 1, type: '1' } },
      userProfile: { id: '1', role: 'Company Owner', user_type: '1' },
    }));
    vi.mocked(fetchStaff).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
    });
    vi.mocked(fetchAccessGroups).mockResolvedValue([
      { id: 'group-7', name: 'Warehouse Personnel', access_rights: [], description: '' },
      { id: 'group-9', name: 'Sales Agent', access_rights: [], description: '' },
    ] as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates a staff account from the header action', async () => {
    const user = userEvent.setup();
    vi.mocked(createStaff).mockResolvedValue({ id: 'staff-9' } as any);
    render(<ToastProvider><Staff /></ToastProvider>);

    await user.click(await screen.findByRole('button', { name: 'Add Staff Account' }));
    expect(screen.getByRole('heading', { name: 'Create Staff Account' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Jane Doe'), 'Jane Doe');
    const accountInput = screen.getByPlaceholderText('Email address or username');
    expect(accountInput).toHaveAttribute('type', 'text');
    await user.type(accountInput, 'melson');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'StrongPass1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'group-9');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Jane Doe',
      email: 'melson',
      password: 'StrongPass1',
      role: 'Sales Agent',
      group_id: 'group-9',
    })));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create Staff Account' })).not.toBeInTheDocument());
  });

  it('lets the Master User change a staff password and warns about sign-out', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStaff).mockResolvedValue({
      items: [{ id: 'staff-9', full_name: 'Jane Doe', email: 'jane@example.com', role: 'Sales Agent', mobile: '', team_id: '', status: 1, created_at: '' }],
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
    });
    vi.mocked(changeStaffPassword).mockResolvedValue(undefined);
    render(<ToastProvider><Staff /></ToastProvider>);

    await user.click(await screen.findByRole('button', { name: 'Change password for Jane Doe' }));
    await user.type(screen.getByLabelText('New Password'), 'NewStrongPass1');
    await user.type(screen.getByLabelText('Confirm New Password'), 'NewStrongPass1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(changeStaffPassword).toHaveBeenCalledWith('staff-9', 'NewStrongPass1'));
    expect(await screen.findByText(/sessions and registered phones were signed out/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Change Staff Password' })).not.toBeInTheDocument();
  });

  it('does not expose the password action to staff users', async () => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'staff-token',
      context: { user_type: '2', user: { id: 2, type: '2' } },
      userProfile: { id: '2', role: 'Sales Agent', user_type: '2' },
    }));
    vi.mocked(fetchStaff).mockResolvedValue({
      items: [{ id: 'staff-9', full_name: 'Jane Doe', email: 'jane@example.com', role: 'Sales Agent', mobile: '', team_id: '', status: 1, created_at: '' }],
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
    });
    render(<ToastProvider><Staff /></ToastProvider>);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Change password for Jane Doe' })).not.toBeInTheDocument());
  });
});
