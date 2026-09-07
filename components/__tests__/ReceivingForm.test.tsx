import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getSuppliers: vi.fn(),
  getEligiblePurchaseOrders: vi.fn(),
};

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock('../CustomLoadingSpinner', () => ({ default: () => <span>Loading spinner</span> }));
vi.mock('../SearchableSelect', () => ({
  default: () => <select aria-label="Posted PO Reference"><option value="">Select posted PO...</option></select>,
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  service.getSuppliers.mockResolvedValue([]);
  service.getEligiblePurchaseOrders.mockResolvedValue([]);
});

describe('ReceivingForm', () => {
  it('does not show unit cost, line total, or grand total', async () => {
    const { default: ReceivingForm } = await import('../ReceivingStock/ReceivingForm');
    render(<ReceivingForm onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /receiving stock/i })).toBeInTheDocument();
    expect(screen.queryByText('Unit Cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Grand Total')).not.toBeInTheDocument();
    expect(screen.getByText('Qty Recv')).toBeInTheDocument();
  });
});
