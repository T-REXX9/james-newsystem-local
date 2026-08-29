import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import CustomerDatabase from '../CustomerDatabase';
import { ToastProvider } from '../ToastProvider';

// The hook is mocked so we can drive `isLoading` and `data` from each test.
const realtimeState = {
  data: [] as any[],
  setData: vi.fn(),
  refetch: vi.fn(),
  isLoading: true as boolean,
};

vi.mock('../../hooks/useRealtimeList', () => ({
  useRealtimeList: () => realtimeState,
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: vi.fn(),
  bulkUpdateContacts: vi.fn(),
  updateContact: vi.fn(),
  createContact: vi.fn(),
}));

vi.mock('../CustomerListSidebar', () => ({
  default: () => <div>CustomerListSidebar</div>,
}));

vi.mock('../CustomerDetailPanel', () => ({
  default: ({ contactId, initialData }: { contactId: string; initialData?: any }) => (
    <div>CustomerDetailPanel:{contactData(contactId, initialData)}</div>
  ),
}));

vi.mock('../BulkAssignAgentModal', () => ({ default: () => null }));
vi.mock('../BulkSetPriceGroupModal', () => ({ default: () => null }));
vi.mock('../AddContactModal', () => ({ default: () => null }));

const contactData = (contactId: string, initialData: any) => {
  if (initialData?.id === contactId) return initialData.company;
  return 'pending';
};

describe('CustomerDatabase - initialContactId loading state', () => {
  beforeEach(() => {
    realtimeState.data = [];
    realtimeState.isLoading = true;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a loading indicator when arriving with an initialContactId and contacts are still loading', () => {
    realtimeState.isLoading = true;
    realtimeState.data = [];

    render(
      <ToastProvider>
        <CustomerDatabase initialContactId="c-42" />
      </ToastProvider>
    );

    // The "no data" / "Select a customer" empty state must NOT be shown
    expect(screen.queryByText(/select a customer/i)).not.toBeInTheDocument();
    // A loading indicator is visible
    expect(screen.getByTestId('customer-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading customer record/i)).toBeInTheDocument();
  });

  it('renders the detail panel once the contacts list finishes loading and the id is found', async () => {
    realtimeState.isLoading = false;
    realtimeState.data = [
      { id: 'c-42', company: 'Acme Hardware' },
      { id: 'c-99', company: 'Beta Trading' },
    ];

    render(
      <ToastProvider>
        <CustomerDatabase initialContactId="c-42" />
      </ToastProvider>
    );

    // The detail panel renders with the company from initialData
    expect(await screen.findByText(/Acme Hardware/)).toBeInTheDocument();
    // The loading indicator is gone
    expect(screen.queryByTestId('customer-loading')).not.toBeInTheDocument();
  });

  it('falls back to the "Select a customer" empty state when the initial id is unknown', async () => {
    realtimeState.isLoading = false;
    realtimeState.data = [{ id: 'c-1', company: 'Acme Hardware' }];

    render(
      <ToastProvider>
        <CustomerDatabase initialContactId="c-does-not-exist" />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/select a customer/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('customer-loading')).not.toBeInTheDocument();
  });

  it('shows the "Select a customer" empty state when no initialContactId is provided', () => {
    realtimeState.isLoading = false;
    realtimeState.data = [{ id: 'c-1', company: 'Acme Hardware' }];

    render(
      <ToastProvider>
        <CustomerDatabase />
      </ToastProvider>
    );

    expect(screen.getByText(/select a customer/i)).toBeInTheDocument();
  });
});
