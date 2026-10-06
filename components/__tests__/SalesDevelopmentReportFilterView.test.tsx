import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesDevelopmentReportDataView from '../SalesDevelopmentReportFilterView';
import InquiryDetailsModal from '../InquiryDetailsModal';
import { getSalesDevelopmentDemandSummaryLocal, getSalesDevelopmentReportDataLocal } from '../../services/salesDevelopmentReportLocalApiService';
import { formatDate } from '../../utils/formatUtils';

vi.mock('../../services/salesDevelopmentReportLocalApiService', () => ({
  getSalesDevelopmentReportDataLocal: vi.fn(),
  getSalesDevelopmentDemandSummaryLocal: vi.fn(),
}));

const reportDataMock = vi.mocked(getSalesDevelopmentReportDataLocal);
const demandSummaryMock = vi.mocked(getSalesDevelopmentDemandSummaryLocal);

afterEach(cleanup);

describe('Sales Development Report record actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportDataMock.mockResolvedValue([{
      id: 'item-1',
      inquiry_id: 'inq-ref-1',
      inquiry_no: 'INQ-1',
      customer_company: 'Acme',
      sales_person: 'Melson',
      sales_date: '2026-10-02',
      part_no: 'PART-1',
      item_code: 'ITEM-1',
      description: 'Sample item',
      qty: 2,
      unit_price: 50,
      amount: 100,
      remark: 'OnStock',
    }]);
    demandSummaryMock.mockResolvedValue([]);
  });

  it('routes the inquiry action to the matching Sales Inquiry record', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <SalesDevelopmentReportDataView
        dateFrom="2026-10-01"
        dateTo="2026-10-05"
        reportCategory="not_purchase"
        onBack={vi.fn()}
      />,
    );

    const recordAction = await screen.findByRole('link', { name: 'Open inquiry INQ-1' });
    expect(recordAction).toHaveAttribute('href', '#/sales-transaction-sales-inquiry?inquiryId=inq-ref-1');
    expect(recordAction).toHaveAttribute('target', '_self');
    fireEvent.click(recordAction);

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: {
        tab: 'sales-transaction-sales-inquiry',
        payload: { inquiryId: 'inq-ref-1' },
        mode: 'push',
      },
    })));
  });

  it('renders inquiry details without a recursive date-formatting crash', () => {
    render(
      <InquiryDetailsModal
        isOpen
        onClose={vi.fn()}
        inquiry={{ inquiry_no: 'INQ-1', sales_date: '2026-10-02' }}
      />,
    );

    expect(screen.getByText(formatDate('2026-10-02'))).toBeInTheDocument();
  });
});
