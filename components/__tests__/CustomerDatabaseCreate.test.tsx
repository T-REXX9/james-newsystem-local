import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerDatabase from '../CustomerDatabase';
import { ToastProvider } from '../ToastProvider';

const refetchMock = vi.fn();
const setDataMock = vi.fn();

vi.mock('../../hooks/useRealtimeList', () => ({
  useRealtimeList: () => ({
    data: [],
    setData: setDataMock,
    refetch: refetchMock,
  }),
}));

const createContactMock = vi.fn();
vi.mock('../../services/supabaseService', () => ({
  fetchContacts: vi.fn(),
  bulkUpdateContacts: vi.fn(),
  createContact: (...args: any[]) => createContactMock(...args),
}));

// Keep test focused on the create flow.
vi.mock('../CustomerListSidebar', () => ({
  default: ({ onCreateNew }: { onCreateNew: () => void }) => (
    <button onClick={onCreateNew}>New Customer</button>
  ),
}));

vi.mock('../CustomerDetailPanel', () => ({
  default: () => <div>CustomerDetailPanel</div>,
}));

vi.mock('../BulkAssignAgentModal', () => ({
  default: () => null,
}));

describe('CustomerDatabase - create new customer', () => {
  beforeEach(() => {
    createContactMock.mockReset();
    refetchMock.mockReset();
    setDataMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the AddContactModal and submits to createContact', async () => {
    const user = userEvent.setup();
    createContactMock.mockResolvedValue({ id: 'c-1', company: 'Acme Corp' });

    render(
      <ToastProvider>
        <CustomerDatabase />
      </ToastProvider>
    );

    await user.click(screen.getByText('New Customer'));
    expect(await screen.findByText('Add New Customer')).toBeInTheDocument();

    const companyInput = screen.getByPlaceholderText('e.g. Acme Corp');
    await user.type(companyInput, 'Acme Corp');

    await user.click(screen.getByRole('button', { name: /save customer/i }));

    await waitFor(() => expect(createContactMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refetchMock).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.queryByText('Add New Customer')).not.toBeInTheDocument();
    });
  });
});
