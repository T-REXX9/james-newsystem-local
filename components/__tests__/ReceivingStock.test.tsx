import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowHistoryState } from '../../utils/workflowHistory';

const service = {
  getReceivingReports: vi.fn(),
};

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ReceivingStock/ReceivingForm', () => ({ default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: (report: unknown) => void }) => <div><button type="button" onClick={onClose}>Close form</button><button type="button" onClick={() => onSuccess({ id: 'RRREF-1' })}>Save receiving report</button></div> }));
vi.mock('../ReceivingStock/ReceivingView', () => ({ default: ({ rrId, onBack, onCreateNew }: { rrId: string; onBack: () => void; onCreateNew: () => void }) => <div><span>Receiving detail {rrId}</span><button type="button" onClick={onBack}>Back to receiving list</button><button type="button" onClick={onCreateNew}>New RR</button></div> }));

const report = { id: 'RRREF-1', rr_no: 'RR-2601', receive_date: '2026-08-20', supplier_name: 'Supplier 1', po_no: 'PO-2601', status: 'Draft', item_count: 2, items: [] };

afterEach(() => cleanup());

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
  service.getReceivingReports.mockResolvedValue([report]);
});

describe('ReceivingStock module', () => {
  it('renders server item counts and opens a selected report', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    expect(await screen.findByText('RR-2601')).toBeInTheDocument();
    expect(screen.getByText('All Months')).toBeInTheDocument();
    expect(screen.getByText('All Years')).toBeInTheDocument();
    await waitFor(() => expect(service.getReceivingReports).toHaveBeenCalledWith(expect.objectContaining({ month: 'all', year: 'all' })));
    expect(screen.getByText('2 Items ❯')).toBeInTheDocument();
    fireEvent.click(screen.getByText('RR-2601'));
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
  });

  it('reloads receiving reports when a specific month and year are selected', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    await screen.findByText('RR-2601');

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } });

    await waitFor(() => expect(service.getReceivingReports).toHaveBeenCalledWith(expect.objectContaining({ month: '8', year: '2026' })));
  });

  it('opens a newly saved report directly in detail view', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    fireEvent.click(await screen.findByRole('button', { name: /generate receiving report/i }));
    fireEvent.click(screen.getByRole('button', { name: /save receiving report/i }));
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
    await waitFor(() => expect(service.getReceivingReports).toHaveBeenCalled());
  });

  it('starts a fresh receiving report from an existing report detail view', async () => {
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock />);
    fireEvent.click(await screen.findByRole('button', { name: /RR-2601/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'New RR' }));
    expect(screen.getByRole('button', { name: 'Save receiving report' })).toBeInTheDocument();
  });

  it('opens an initial receiving deep link', async () => {
    service.getReceivingReports.mockResolvedValueOnce([]);
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock initialRRId="RRREF-1" />);
    expect(await screen.findByText('Receiving detail RRREF-1')).toBeInTheDocument();
  });

  it('retraces the previous workflow from a linked receiving report', async () => {
    window.history.replaceState(createWorkflowHistoryState('#/warehouse-reports-reorder-report'), '', '/#/warehouse-receiving-stock?rrId=RRREF-1');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { default: ReceivingStock } = await import('../ReceivingStock');
    render(<ReceivingStock initialRRId="RRREF-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Back to receiving list' }));
    expect(backSpy).toHaveBeenCalledOnce();
    backSpy.mockRestore();
  });
});
