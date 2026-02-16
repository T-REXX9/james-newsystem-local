import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AccessControlSettings from './AccessControlSettings';
import { DEFAULT_STAFF_ACCESS_RIGHTS } from '../constants';
import { createStaffAccount, fetchProfiles } from '../services/supabaseService';
import { ToastProvider } from './ToastProvider';

vi.mock('../services/supabaseService', () => ({
  fetchProfiles: vi.fn(),
  updateProfile: vi.fn(),
  createStaffAccount: vi.fn(),
  getCurrentNotificationActor: vi.fn().mockResolvedValue({ actorId: 'owner-1', actorRole: 'Owner' }),
  notifyAccessRightsChange: vi.fn().mockResolvedValue(undefined),
  notifyStaffAccountCreated: vi.fn().mockResolvedValue(undefined),
}));

const fetchProfilesMock = fetchProfiles as unknown as ReturnType<typeof vi.fn>;
const createStaffAccountMock = createStaffAccount as unknown as ReturnType<typeof vi.fn>;

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.resetAllMocks();
  fetchProfilesMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('AccessControlSettings - create staff account', () => {
  it('creates a staff account and refreshes profiles on success', async () => {
    const user = userEvent.setup();
    const refreshedProfiles = [{ id: '1', full_name: 'Owner', email: 'owner@example.com', role: 'Owner', access_rights: ['*'] }];
    fetchProfilesMock.mockResolvedValueOnce([]).mockResolvedValueOnce(refreshedProfiles);
    createStaffAccountMock.mockResolvedValue({ success: true, userId: 'new-user' });

    renderWithProviders(<AccessControlSettings />);

    const addButtons = await screen.findAllByText('Add New Account');
    await user.click(addButtons[0]);

    await user.type(screen.getByPlaceholderText('e.g. John Doe'), 'Jane Doe');
    await user.selectOptions(screen.getByRole('combobox'), 'Manager');
    await user.type(screen.getByPlaceholderText('staff@company.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('0917...'), '09171234567');
    await user.type(screen.getByPlaceholderText('Set initial password'), 'StrongPass1');

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(createStaffAccountMock).toHaveBeenCalledTimes(1));
    expect(createStaffAccountMock).toHaveBeenCalledWith({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass1',
      role: 'Manager',
      birthday: undefined,
      mobile: '09171234567',
      accessRights: DEFAULT_STAFF_ACCESS_RIGHTS
    });

    await waitFor(() => expect(fetchProfilesMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Create Staff Account')).not.toBeInTheDocument());
    expect(screen.getByText(/Account created for Jane Doe/i)).toBeInTheDocument();
  });

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
    expect(await screen.findByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    expect(createStaffAccountMock).not.toHaveBeenCalled();
  });

  it('keeps the modal open and renders field errors when service validation fails', async () => {
    const user = userEvent.setup();
    fetchProfilesMock.mockResolvedValue([]);
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
});
