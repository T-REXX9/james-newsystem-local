import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getReceivingReports: vi.fn(),
};

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ReceivingStock/ReceivingForm', () => ({ default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: (report: unknown) => void }) => <div><button type="button" onClick={onClose}>Close form</button><button type="button" onClick={() => onSuccess({ id: 'RRREF-1' })}>Save receiving report</button></div> }));
vi.mock('../ReceivingStock/ReceivingView', () => ({ default: ({ rrId, onBack }: { rrId: string; onBack: () => void }) => <div><span>Receiving detail {rrId}</span><button type="button" onClick={onBack}>Back to receiving list</button></div> }));

const report = { id: 'RRREF-1', rr_no: 'RR-2601', receive_date: '2026-08-20', supplier_name: 'Supplier 1', po_no: 'PO-2601', status: 'Draft', item_count: 2, items: [] };

afterEach(() => cleanup());

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  service.getReceivingReports.mockResolvedValue([report]);
});

describe('ReceivingStock module', () => {
  it('renders server item counts and opens a selected report', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    expect(await screen.findByText('RR-2601')).toBeInTheDocument();
    expect(screen.getByText('2 Items ❯')).toBeInTheDocument();
    fireEvent.click(screen.getByText('RR-2601'));
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
  });

  it('opens a newly saved report directly in detail view', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    fireEvent.click(await screen.findByRole('button', { name: /generate receiving report/i }));
    fireEvent.click(screen.getByRole('button', { name: /save receiving report/i }));
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
    await waitFor(() => expect(service.getReceivingReports).toHaveBeenCalled());
  });

  it('opens an initial receiving deep link', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock initialRRId="RRREF-1" />);
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
  });
});
