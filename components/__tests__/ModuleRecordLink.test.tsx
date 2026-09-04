import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModuleRecordLink, { buildModuleRecordHref } from '../ModuleRecordLink';
import ModuleRecordAction from '../ModuleRecordAction';

describe('ModuleRecordLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('builds a deep link that can be opened in a new browser tab', () => {
    expect(buildModuleRecordHref('warehouse-purchasing-purchase-order', {
      poId: 'PO REF/1',
      empty: undefined,
    })).toBe('#/warehouse-purchasing-purchase-order?poId=PO+REF%2F1');
  });

  it('uses in-app navigation for a normal click but preserves modified clicks', () => {
    const onOpen = vi.fn();
    render(<ModuleRecordLink tab="record-page" payload={{ id: '1' }} onOpen={onOpen}>REC-1</ModuleRecordLink>);
    const link = screen.getByRole('link', { name: 'REC-1' });

    expect(link).toHaveAttribute('href', '#/record-page?id=1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(link, { ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('syncs the current record into the hash when replace mode is set', () => {
    const onOpen = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <ModuleRecordLink tab="sales-transaction-sales-inquiry" payload={{ inquiryId: 'inq-1' }} mode="replace" onOpen={onOpen}>
        SI-1
      </ModuleRecordLink>
    );

    fireEvent.click(screen.getByRole('link', { name: 'SI-1' }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: expect.objectContaining({
        tab: 'sales-transaction-sales-inquiry',
        payload: { inquiryId: 'inq-1' },
        mode: 'replace',
      }),
    }));
  });

  it('opens the linked record in a new window from the split action', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <ModuleRecordAction tab="sales-transaction-sales-order" payload={{ orderId: 'so-1' }}>
        View Sales Order
      </ModuleRecordAction>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open in new window' }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('#/sales-transaction-sales-order?orderId=so-1'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('does not intercept a normal click when explicitly opening in a new tab', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<ModuleRecordLink openInNewTab tab="record-page" payload={{ id: '2' }}>REC-2</ModuleRecordLink>);
    const link = screen.getByRole('link', { name: 'REC-2' });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fireEvent.click(link)).toBe(true);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
