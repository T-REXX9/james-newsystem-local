import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionSummaryView from '../CollectionSummaryView';
import { dailyCollectionService } from '../../services/dailyCollectionService';

vi.mock('../../services/dailyCollectionService', () => ({
  dailyCollectionService: { getSummary: vi.fn() },
}));

vi.mock('../CustomerStarIndicator', () => ({
  default: () => null,
}));

const report = {
  date_from: '2026-09-01',
  date_to: '2026-09-30',
  collection_items: [{
    customer_id: 'customer-1', date: '2026-09-10', created_at: '2026-09-10 09:15:00',
    customer: 'Alpha Corp', dcr_no: 'DCR-1001', cash: 100, check: 200, tt: 300, less: 0,
    remarks: 'Paid in full',
  }],
  collection_totals: { cash: 100, check: 200, tt: 300, less: 0 },
  debit_items: [{
    customer_id: 'customer-1', lrefno: 'REF-DM-1', ldm_no: 'DM-1001', lcustomer_code: 'C001',
    lcustomer_name: 'Alpha Corp', ldatetime: '2026-09-11', created_at: '2026-09-11 10:20:00', lamount: 450,
  }],
  debit_totals: { amount: 450 },
};

describe('CollectionSummaryView', () => {
  beforeEach(() => {
    vi.mocked(dailyCollectionService.getSummary).mockReset();
    vi.mocked(dailyCollectionService.getSummary).mockResolvedValue(report);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps report options on their own screen and shows the legacy report view after generation', async () => {
    render(<CollectionSummaryView />);
    expect(screen.getByRole('heading', { name: 'Collection Report' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'DEBIT MEMO (DM) SUMMARY' })).toBeNull();

    fireEvent.change(screen.getByLabelText(/Report Type/), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/Date From/), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/Date To/), { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(await screen.findByRole('heading', { name: 'DEBIT MEMO (DM) SUMMARY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Option/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Preview/ })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Timestamp' })).toHaveLength(2);
    expect(screen.getByText('DCR-1001')).toBeInTheDocument();
    expect(screen.getByText('GRAND TOTAL -->')).toBeInTheDocument();
    expect(dailyCollectionService.getSummary).toHaveBeenCalledWith(expect.objectContaining({
      dateType: 'custom', dateFrom: '2026-09-01', dateTo: '2026-09-30',
    }));
  });

  it('returns to the options screen without clearing the selected period', async () => {
    render(<CollectionSummaryView />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    await screen.findByRole('heading', { name: 'DEBIT MEMO (DM) SUMMARY' });
    fireEvent.click(screen.getByRole('button', { name: /Back to Option/ }));

    expect(await screen.findByRole('heading', { name: 'Collection Report' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Report Type/)).toHaveValue('today');
    expect(screen.queryByRole('button', { name: /Print Preview/ })).toBeNull();
  });

  it('opens print preview from the result screen', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<CollectionSummaryView />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    await screen.findByRole('heading', { name: 'DEBIT MEMO (DM) SUMMARY' });
    fireEvent.click(screen.getByRole('button', { name: /Print Preview/ }));

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('validates the custom date range before calling the report service', () => {
    render(<CollectionSummaryView />);
    fireEvent.change(screen.getByLabelText(/Report Type/), { target: { value: 'custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Custom date range requires Date From and Date To');
    expect(dailyCollectionService.getSummary).not.toHaveBeenCalled();
  });
});
