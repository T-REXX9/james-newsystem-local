import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseRequestView from '../PurchaseRequest/PurchaseRequestView';

vi.mock('../ProductAutocomplete', () => ({
  default: ({ onSelect, reorderOnly }: { onSelect: (product: any) => void; reorderOnly?: boolean }) => (
    <button
      type="button"
      data-reorder-only={String(Boolean(reorderOnly))}
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

  afterEach(() => {
    cleanup();
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

  it('uses the confirmation modal before generating a purchase order', async () => {
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

    await user.click(screen.getByRole('button', { name: /select all open items/i }));
    await user.click(screen.getByRole('button', { name: /generate purchase order/i }));
    expect(screen.getByText(/create purchase order\(s\) from pr-2601/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /generate po/i }));

    await waitFor(() => expect(onConvert).toHaveBeenCalledTimes(1));
  });

  it('lets the user assign a supplier from the pending PR line', async () => {
    const user = userEvent.setup();
    const onUpdateItem = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={baseRequest as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={onUpdateItem}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[{ id: 'sup-2', company: 'Supplier Two' } as any]}
      />
    );

    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Supplier PART-OLD' }).at(-1)!,
      'sup-2',
    );

    await waitFor(() =>
      expect(onUpdateItem).toHaveBeenCalledWith('101', {
        supplier_id: 'sup-2',
        supplier_name: 'Supplier Two',
      }),
    );
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
    expect(screen.getByRole('button', { name: 'Pick View Product' })).toHaveAttribute('data-reorder-only', 'true');

    await user.click(screen.getByRole('button', { name: /close add item/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pick View Product' })).not.toBeInTheDocument();
    });
  });

  it('opens the matching return records from the Review recommendation', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          items: [{
            ...baseRequest.items[0],
            item_code: 'ITEM-RETURNED',
            sr_cases: 1,
            ir_cases: 2,
          }],
        } as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: /review return history for part-old/i }));
    expect(screen.getByRole('dialog', { name: /return history/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sales returns/i }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('#/accounting-reports-sales-return-report?'),
      '_blank',
      'noopener,noreferrer',
    );
    expect(openSpy.mock.calls[0][0]).toContain('search=ITEM-RETURNED');
    expect(openSpy.mock.calls[0][0]).toContain('itemRefno=');
    expect(openSpy.mock.calls[0][0]).toContain('status=Posted');

    await user.click(screen.getByRole('button', { name: /supplier returns/i }));
    expect(openSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('#/warehouse-purchasing-return-to-supplier?'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('links a PR item to the exact purchase order record', () => {
    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          status: 'Submitted',
          items: [{
            ...baseRequest.items[0],
            po_refno: 'POREF-308',
            po_number: 'PO-26308',
          }],
        } as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    const linePoLink = screen.getByRole('link', { name: 'Open line purchase order PO-26308' });
    expect(linePoLink).toHaveAttribute(
      'href',
      '#/warehouse-purchasing-purchase-order?poId=POREF-308&poRefNo=PO-26308',
    );
    expect(linePoLink).toHaveAttribute('target', '_blank');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    linePoLink.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(screen.queryByText(/purchase order generated/i)).not.toBeInTheDocument();
  });

  it('hides PO generation once every PR line already has a PO', () => {
    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          status: 'Approved',
          items: [{
            ...baseRequest.items[0],
            po_refno: 'POREF-308',
            po_number: 'PO-26308',
          }],
        } as any}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    expect(screen.getByRole('link', { name: 'Open line purchase order PO-26308' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate purchase order/i })).not.toBeInTheDocument();
  });

  it('uses PR line checkboxes to select open items for the next PO', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          status: 'Approved',
          items: [
            {
              id: '101',
              part_number: 'PART-PO',
              item_code: 'ITEM-PO',
              description: 'Already ordered',
              quantity: 1,
              supplier_id: 'sup-1',
              supplier_name: 'Supplier One',
              po_refno: 'POREF-1',
              po_number: 'PO-1',
            },
            {
              id: '102',
              part_number: 'PART-A',
              item_code: 'ITEM-A',
              description: 'Open supplier one item',
              quantity: 2,
              supplier_id: 'sup-1',
              supplier_name: 'Supplier One',
            },
            {
              id: '103',
              part_number: 'PART-B',
              item_code: 'ITEM-B',
              description: 'Open supplier two item',
              quantity: 3,
              supplier_id: 'sup-2',
              supplier_name: 'Supplier Two',
            },
          ],
        } as any}
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

    const existingPoCheckbox = screen.getByRole('checkbox', { name: /part-po already on po po-1/i });
    expect(existingPoCheckbox).toBeChecked();
    expect(existingPoCheckbox).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open line purchase order PO-1' })).toHaveAttribute(
      'href',
      '#/warehouse-purchasing-purchase-order?poId=POREF-1&poRefNo=PO-1',
    );

    const supplierOneCheckbox = screen.getByRole('checkbox', { name: /select part-a for po/i });
    const supplierTwoCheckbox = screen.getByRole('checkbox', { name: /select part-b for po/i });
    expect(supplierOneCheckbox).not.toBeChecked();
    expect(supplierTwoCheckbox).not.toBeChecked();
    expect(supplierTwoCheckbox).not.toBeDisabled();

    await user.click(supplierOneCheckbox);
    await user.click(supplierTwoCheckbox);

    await user.click(screen.getByRole('button', { name: /generate purchase order/i }));
    expect(screen.getByText(/system will create 2 pos, one per supplier/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /generate po/i }));

    await waitFor(() => expect(onConvert).toHaveBeenCalledWith(['102', '103']));
  });

  it('selects every open PR line from all suppliers with the select all control', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          status: 'Approved',
          items: [
            {
              id: '101',
              part_number: 'PART-PO',
              item_code: 'ITEM-PO',
              description: 'Already ordered',
              quantity: 1,
              supplier_id: 'sup-1',
              supplier_name: 'Supplier One',
              po_refno: 'POREF-1',
              po_number: 'PO-1',
            },
            {
              id: '102',
              part_number: 'PART-A',
              item_code: 'ITEM-A',
              description: 'Open supplier one item',
              quantity: 2,
              supplier_id: 'sup-1',
              supplier_name: 'Supplier One',
            },
            {
              id: '103',
              part_number: 'PART-B',
              item_code: 'ITEM-B',
              description: 'Open supplier two item',
              quantity: 3,
              supplier_id: 'sup-2',
              supplier_name: 'Supplier Two',
            },
          ],
        } as any}
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

    await user.click(screen.getByRole('button', { name: /select all open items/i }));

    expect(screen.getByRole('checkbox', { name: /part-po already on po po-1/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /select part-a for po/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /select part-b for po/i })).toBeChecked();

    await user.click(screen.getByRole('button', { name: /generate purchase order/i }));
    await user.click(screen.getByRole('button', { name: /generate po/i }));

    await waitFor(() => expect(onConvert).toHaveBeenCalledWith(['102', '103']));
  });

  it('allows an unposted PR with a linked unposted PO to be posted again', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <PurchaseRequestView
        request={{
          ...baseRequest,
          status: 'Unposted',
          items: [{
            ...baseRequest.items[0],
            po_refno: 'POREF-308',
            po_number: 'PO-26308',
          }],
        } as any}
        onBack={vi.fn()}
        onUpdate={onUpdate}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={vi.fn()}
        onConvert={vi.fn()}
        onPrint={vi.fn()}
        products={[]}
        suppliers={[]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /^post$/i })[0]);
    expect(screen.getByRole('heading', { name: /post purchase request/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /^post$/i }).at(-1)!);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('PRREF-1', { status: 'Approved' }));
  });
});
