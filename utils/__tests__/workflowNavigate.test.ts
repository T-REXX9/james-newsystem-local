import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildModuleRecordHref,
  buildModuleRecordUrl,
  compactWorkflowPayload,
  navigateWorkflow,
  openModuleInNewWindow,
  WORKFLOW_NAVIGATE_EVENT,
} from '../workflowNavigate';

describe('workflowNavigate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compacts empty payload values', () => {
    expect(compactWorkflowPayload({ inquiryId: '1', empty: undefined, blank: '' })).toEqual({ inquiryId: '1' });
    expect(compactWorkflowPayload({})).toBeUndefined();
  });

  it('builds a hash deep link', () => {
    expect(buildModuleRecordHref('sales-transaction-sales-order', { orderId: 'SO/1' }))
      .toBe('#/sales-transaction-sales-order?orderId=SO%2F1');
  });

  it('dispatches replace or push navigation', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    navigateWorkflow('sales-transaction-sales-inquiry', { inquiryId: 'inq-1' }, 'replace');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: WORKFLOW_NAVIGATE_EVENT,
      detail: {
        tab: 'sales-transaction-sales-inquiry',
        payload: { inquiryId: 'inq-1' },
        mode: 'replace',
      },
    }));
  });

  it('opens a module URL in a new window', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    openModuleInNewWindow('sales-reports-sales-map');
    expect(openSpy).toHaveBeenCalledWith(
      buildModuleRecordUrl('sales-reports-sales-map'),
      '_blank',
      'noopener,noreferrer'
    );
  });
});
