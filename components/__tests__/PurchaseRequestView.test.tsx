import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseRequestView from '../PurchaseRequest/PurchaseRequestView';

vi.mock('../ProductAutocomplete', () => ({
  default: ({ onSelect }: { onSelect: (product: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: 'prod-2',
          part_no: 'PART-002',
          item_code: 'ITEM-002',
          description: 'Widget Beta',
          cost: 80,
        })
      }
    >
      Pick View Product
    </button>
  ),
}));

const baseRequest = {
  id: 'PRREF-1',
  pr_number: 'PR-2601',
  request_date: '2026-03-26',
  reference_no: 'EXT-1',
  notes: 'Urgent items',
  status: 'Pending',
  items: [
    {
      id: '101',
      part_number: 'PART-OLD',
      description: 'Existing Item',
      quantity: 2,
      supplier_id: '',
      supplier_name: '',
      eta_date: '',
    },
  ],
};

describe('PurchaseRequestView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the confirmation modal before deleting an item', async () => {
    const user = userEvent.setup();
    const onDeleteItem = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={baseRequest as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={onDeleteItem}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete part-old/i }));
    expect(screen.getByText(/are you sure you want to delete part-old/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(onDeleteItem).toHaveBeenCalledWith('101'));
  });

  it('uses the confirmation modal before converting to purchase order', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={{ ...baseRequest, status: 'Approved' } as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={onConvert}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: /convert to po/i }));
    expect(screen.getByText(/create a new purchase order from pr-2601/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^convert$/i }));

    await waitFor(() => expect(onConvert).toHaveBeenCalledTimes(1));
  });

  it('opens and closes the inline add row with the new close control', async () => {
    const user = userEvent.setup();

    render(
      <PurchaseRequestView
        request={baseRequest as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[{ id: 'sup-2', company: 'Supplier Two' } as any]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /add item/i })[0]);
    expect(screen.getByRole('button', { name: 'Pick View Product' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close add item/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pick View Product' })).not.toBeInTheDocument();
    });
  });
});
