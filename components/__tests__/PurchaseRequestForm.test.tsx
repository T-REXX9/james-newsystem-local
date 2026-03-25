import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseRequestForm from '../PurchaseRequest/PurchaseRequestForm';

const addToastMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../ProductAutocomplete', () => ({
  default: ({ onSelect }: { onSelect: (product: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: 'prod-1',
          part_no: 'PART-001',
          item_code: 'ITEM-001',
          description: 'Widget Alpha',
          cost: 55,
        })
      }
    >
      Pick Product
    </button>
  ),
}));

describe('PurchaseRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a selected item and submits the expected payload including eta_date', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <PurchaseRequestForm
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        initialPRNumber="PR-2601"
        suppliers={[{ id: 'sup-1', company: 'Supplier One' } as any]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Pick Product' }));
    const qtyInput = screen.getByLabelText('Line item quantity');
    await user.clear(qtyInput);
    await user.type(qtyInput, '3');
    await user.selectOptions(screen.getByLabelText('Line item supplier'), 'sup-1');
    const etaInput = screen.getByLabelText('Line item ETA') as HTMLInputElement;
    await user.type(etaInput, '2026-03-31');
    await user.click(screen.getByRole('button', { name: /add line item/i }));

    expect(screen.getByText('PART-001')).toBeInTheDocument();
    expect(screen.getByText('Widget Alpha')).toBeInTheDocument();
    expect(etaInput.value).toBe('');

    await user.click(screen.getByRole('button', { name: /create request/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        pr_number: 'PR-2601',
        items: [
          expect.objectContaining({
            item_id: 'prod-1',
            part_number: 'PART-001',
            quantity: 3,
            supplier_id: 'sup-1',
            supplier_name: 'Supplier One',
            eta_date: '2026-03-31',
          }),
        ],
      })
    );
  });
});
