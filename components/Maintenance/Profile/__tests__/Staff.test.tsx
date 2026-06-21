import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Staff from '../Staff';
import { ToastProvider } from '../../../ToastProvider';
import { createStaff, fetchStaff } from '../../../../services/staffLocalApiService';

vi.mock('../../../../services/staffLocalApiService', () => ({
  fetchStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  deleteStaff: vi.fn(),
}));

vi.mock('../../../../services/teamLocalApiService', () => ({
  fetchTeams: vi.fn(async () => ({ items: [], meta: {} })),
}));

describe('Staff Management', () => {
  beforeEach(() => {
    vi.mocked(fetchStaff).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
    });
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
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Jane Doe',
      email: 'melson',
      password: 'StrongPass1',
      role: 'Sales Agent',
    })));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create Staff Account' })).not.toBeInTheDocument());
  });
});
