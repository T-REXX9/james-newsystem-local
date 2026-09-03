import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import CreateIncidentReportModal from '../CreateIncidentReportModal';

const fetchContactTransactionsMock = vi.fn();

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  createDailyCallIncidentReport: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContactTransactions: (...args: unknown[]) => fetchContactTransactionsMock(...args),
  fetchPurchasedItems: vi.fn(async () => []),
  purchasedItemToProduct: vi.fn(),
}));

vi.mock('../../services/incidentItemSyncService', () => ({
  syncIncidentReportItem: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../ProductAutocomplete', () => ({
  default: () => <div>Product search</div>,
}));

vi.mock('../TransactionAutocomplete', () => ({
  default: () => <div>Transaction search</div>,
}));

const localDateValue = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

describe('CreateIncidentReportModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchContactTransactionsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders above the page layout without clipping its header', () => {
    const { getByTestId } = render(
      <div data-testid="page-layout">
        <CreateIncidentReportModal
          contactId="contact-1"
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          currentUser={null}
        />
      </div>
    );

    const dialog = screen.getByRole('dialog', { name: 'Create Incident Report' });
    expect(within(getByTestId('page-layout')).queryByRole('dialog')).not.toBeInTheDocument();
    expect(dialog.parentElement?.parentElement).toHaveClass('z-[11000]');
    expect(dialog).toHaveClass('flex-col', 'overflow-hidden', 'max-h-[calc(100dvh-2rem)]');
    expect(screen.getByText('Create Incident Report').parentElement).toHaveClass('shrink-0');
  });

  it('defaults the incident date to the current local date every time it opens', async () => {
    const firstDate = new Date(2026, 7, 27, 10, 30);
    vi.setSystemTime(firstDate);

    const props = {
      contactId: 'contact-1',
      onClose: vi.fn(),
      onSuccess: vi.fn(),
      currentUser: null,
    };
    const { rerender } = render(<CreateIncidentReportModal {...props} isOpen />);

    const incidentDate = screen.getByLabelText(/Incident Date/) as HTMLInputElement;
    expect(incidentDate.value).toBe(localDateValue(firstDate));

    rerender(<CreateIncidentReportModal {...props} isOpen={false} />);
    const nextDate = new Date(2026, 7, 28, 8, 15);
    vi.setSystemTime(nextDate);
    rerender(<CreateIncidentReportModal {...props} isOpen />);

    expect((screen.getByLabelText(/Incident Date/) as HTMLInputElement).value).toBe(localDateValue(nextDate));
  });

  it('accepts today as the incident date and still rejects tomorrow', async () => {
    const today = new Date(2026, 8, 2, 3, 20);
    vi.setSystemTime(today);

    render(
      <CreateIncidentReportModal
        contactId="contact-1"
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={{ full_name: 'Master User' } as any}
      />
    );

    const incidentDate = screen.getByLabelText(/Incident Date/) as HTMLInputElement;

    fireEvent.blur(incidentDate);
    expect(screen.queryByText('Please choose an incident date that is not in the future.')).not.toBeInTheDocument();

    fireEvent.change(incidentDate, { target: { value: '2026-09-03' } });
    fireEvent.blur(incidentDate);

    expect(screen.getAllByText('Please choose an incident date that is not in the future.').length).toBeGreaterThan(0);
  });
});
