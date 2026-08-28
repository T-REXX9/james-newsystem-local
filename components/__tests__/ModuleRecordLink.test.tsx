import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModuleRecordLink, { buildModuleRecordHref } from '../ModuleRecordLink';

describe('ModuleRecordLink', () => {
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
