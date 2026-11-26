import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceItemsModal } from '../SalesReturnPage';
import type { SourceItem } from '../../services/salesReturnLocalApiService';

const sourceItem: SourceItem = {
  source_item_id: 42,
  linv_refno: 'inventory-item-1',
  item_code: 'ITEM-1',
  part_no: 'PART-1',
  brand: 'Brand',
  description: 'Test source item',
  unit_price: 125,
  original_qty: 4,
  remaining_qty: 0,
  unit: 'pc',
  discount: 0,
};

afterEach(() => cleanup());

describe('Sales Return source-items modal', () => {
  it('keeps a fully allocated linked source item selectable up to its source quantity', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <SourceItemsModal
        open
        sourceItems={[sourceItem]}
        loading={false}
        isNoReference={false}
        onAdd={onAdd}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Source Qty' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '4');
    expect(screen.getByRole('spinbutton')).toHaveValue(4);

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith(sourceItem, 4, '');
  });

  it('keeps purchase-history returns limited to their remaining quantity', () => {
    render(
      <SourceItemsModal
        open
        sourceItems={[{ ...sourceItem, remaining_qty: 2 }]}
        loading={false}
        isNoReference
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '2');
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
  });
});
