import React, { useEffect, useState } from 'react';
import { ArrowLeft, List, Printer, Tags } from 'lucide-react';
import type { InquiryReportFilters } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { inquiryReportLocalApiService } from '../services/inquiryReportLocalApiService';

interface InquiryReportViewProps {
  filters: InquiryReportFilters;
  onBack: () => void;
}

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const displayDate = (value: unknown): string => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US');
};

const displayTime = (value: unknown): string => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const InquiryReportView: React.FC<InquiryReportViewProps> = ({ filters, onBack }) => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      try {
        const data = await inquiryReportLocalApiService.getReport({
          mode: viewMode,
          dateType: filters.reportType,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          customerId: filters.customerId,
        });
        setInquiries(data.items || []);
      } finally {
        setIsLoading(false);
      }
    };
    void loadReport();
  }, [filters, viewMode]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white print:p-0">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-0 print:shadow-none">
        <header className="min-h-[64px] border-b border-[#e5e5e5] px-5 print:hidden">
          <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Inquiry Report View
          </h1>
        </header>

        <main className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#eee] pb-4 print:hidden">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-[3px] border border-[#398439] bg-[#5cb85c] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#47a447]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Options
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                className="flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold text-[#333] hover:bg-[#ebebeb]"
              >
                <List className="h-3.5 w-3.5" />
                {viewMode === 'summary' ? 'Detailed' : 'Summary'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold text-[#333] hover:bg-[#ebebeb]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Preview
              </button>
            </div>
          </div>

          {inquiries.length === 0 ? (
            <div className="py-20 text-center">
              <Tags className="mx-auto mb-4 h-12 w-12 text-[#aaa]" />
              <h3 className="text-[20px] font-semibold text-[#555]">No inquiry found!</h3>
            </div>
          ) : (
            <section id="print_area" className="overflow-x-auto">
              <div className="mb-5 text-center text-[13px]">
                <strong className="text-[20px]">Inquiry Report</strong>
                <br />
                Date from <strong>{filters.dateFrom}</strong> date to <strong>{filters.dateTo}</strong>
                <br />
                System generated <strong>{new Date().toLocaleString('en-US')}</strong>
              </div>

              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-[#f9f9f9]">
                  <tr className="border-b border-[#ddd]">
                    <th className="w-[4%] px-2 py-2 text-center">#</th>
                    <th className="w-[17%] px-2 py-2 text-left">Inquiry#</th>
                    <th className="px-2 py-2 text-left">Sold To</th>
                    <th className="w-[13%] px-2 py-2 text-left">Date</th>
                    <th className="w-[12%] px-2 py-2 text-left">Time</th>
                    <th className="w-[13%] px-2 py-2 text-right">{viewMode === 'summary' ? 'Amount' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry, inquiryIndex) => (
                    <React.Fragment key={inquiry.id || inquiry.inquiry_no || inquiryIndex}>
                      <tr className="border-b border-[#eee] odd:bg-[#f9f9f9]">
                        <td className="px-2 py-2 text-center">{inquiryIndex + 1}</td>
                        <td className="px-2 py-2">{inquiry.inquiry_no}</td>
                        <td className="px-2 py-2">{inquiry.customer_company}</td>
                        <td className="px-2 py-2">{displayDate(inquiry.sales_date)}</td>
                        <td className="px-2 py-2">{displayTime(inquiry.created_at)}</td>
                        <td className="px-2 py-2 text-right">
                          {viewMode === 'summary' ? numberFormat.format(Number(inquiry.grand_total || 0)) : ''}
                        </td>
                      </tr>

                      {viewMode === 'detailed' && (
                        <tr>
                          <td colSpan={6} className="pb-5 pt-1">
                            <table className="w-full border-collapse text-[11px]">
                              <thead>
                                <tr className="border-b border-[#ccc] bg-[#f5f5f5]">
                                  <th className="px-2 py-2 text-center">Quantity</th>
                                  <th className="px-2 py-2 text-center">Item Code</th>
                                  <th className="px-2 py-2 text-center">Location</th>
                                  <th className="px-2 py-2 text-center">Part No</th>
                                  <th className="px-2 py-2 text-center">Brand</th>
                                  <th className="px-2 py-2 text-center">Description</th>
                                  <th className="px-2 py-2 text-center">Unit Price</th>
                                  <th className="px-2 py-2 text-center">Remark</th>
                                  <th className="px-2 py-2 text-center">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(inquiry.items || []).map((item: any, itemIndex: number) => {
                                  const amount = Number(item.qty || 0) * Number(item.unit_price || 0);
                                  return (
                                    <tr key={item.id || itemIndex} className="border-b border-[#eee]">
                                      <td className="px-2 py-2 text-center">{item.qty}</td>
                                      <td className="px-2 py-2 text-center">{item.item_code}</td>
                                      <td className="px-2 py-2 text-center">{item.location || ''}</td>
                                      <td className="px-2 py-2 text-center">{item.part_no}</td>
                                      <td className="px-2 py-2 text-center">{item.brand || ''}</td>
                                      <td className="px-2 py-2 text-center">{item.description}</td>
                                      <td className="px-2 py-2 text-right">{numberFormat.format(Number(item.unit_price || 0))}</td>
                                      <td className="px-2 py-2 text-center">{item.remark || ''}</td>
                                      <td className="px-2 py-2 text-right">{numberFormat.format(amount)}</td>
                                    </tr>
                                  );
                                })}
                                <tr>
                                  <td colSpan={8} className="px-2 py-2 text-right">Grand Total</td>
                                  <td className="px-2 py-2 text-right font-semibold text-[#d9534f]">
                                    {numberFormat.format(Number(inquiry.grand_total || 0))}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default InquiryReportView;
