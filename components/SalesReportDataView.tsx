import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, Tags } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import type { SalesReportData, SalesReportTransaction, UserProfile } from '../types';
import { getSalesReportData } from '../services/salesReportService';
import type { SalesReportPeriod } from './SalesReportFilter';

interface SalesReportDataViewProps {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  reportType: SalesReportPeriod;
  onBack: () => void;
  currentUser?: UserProfile;
}

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const parseReportDate = (value: string): Date => {
  const date = new Date(value);
  return date;
};

const formatRowDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

const formatCenteredDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/ /g, '-').replace(',', '').toUpperCase();
};

const formatCustomDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const displayReportHeading = (reportType: SalesReportPeriod, dateFrom: string, dateTo: string) => {
  const from = parseReportDate(dateFrom);
  return (
    <>
      {reportType === 'custom' && (
        <div className="text-left">
          <p className="text-[18px] font-semibold">SALES REPORT</p>
          <p className="-mt-[10px] text-[16px] font-semibold">DATE COVERED: {formatCustomDate(dateFrom)} to {formatCustomDate(dateTo)}</p>
        </div>
      )}
      {reportType === 'today' && (
        <div className="text-left">
          <p className="text-[18px] font-semibold">DAILY SALES</p>
          <p className="-mt-[15px] text-[16px] font-semibold">{from.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()}</p>
        </div>
      )}
      {reportType === 'month' && (
        <div className="text-left">
          <p className="text-[16px] font-semibold">MONTHLY SALES</p>
          <p className="-mt-[10px] text-[14px]">FOR THE MONTH OF {from.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}</p>
        </div>
      )}
      <div className="text-center">
        <p className="text-[17px] font-semibold">SALES REPORT</p>
        <p className="-mt-[14px] text-[15px]">DATE COVERED: {formatCenteredDate(dateFrom)} TO {formatCenteredDate(dateTo)}</p>
      </div>
    </>
  );
};

const SalesReportDataView: React.FC<SalesReportDataViewProps> = ({
  dateFrom,
  dateTo,
  customerId,
  reportType,
  onBack,
}) => {
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      try {
        setReportData(await getSalesReportData({ dateFrom, dateTo, customerId, dateType: reportType }));
      } finally {
        setIsLoading(false);
      }
    };
    void loadReport();
  }, [dateFrom, dateTo, customerId, reportType]);

  const transactions = useMemo(
    () => [...(reportData?.transactions || [])].sort((left, right) => (
      new Date(left.date).getTime() - new Date(right.date).getTime()
    )),
    [reportData],
  );

  const salespersonGrandTotal = (reportData?.summary.salespersonTotals || []).reduce(
    (total, salesperson) => total + salesperson.total,
    0,
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white print:p-0">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-0 print:shadow-none">
        <header className="flex min-h-[64px] items-center justify-between border-b border-[#e5e5e5] px-5 print:hidden">
          <h1 className="self-stretch border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Sales Report
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-[3px] border border-[#398439] bg-[#5cb85c] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#47a447]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              BACK
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold text-[#333] hover:bg-[#ebebeb]"
            >
              <Printer className="h-3.5 w-3.5" />
              PRINT
            </button>
          </div>
        </header>

        <main id="print_area" className="p-5">
          <div className="mb-5">
            {displayReportHeading(reportType, dateFrom, dateTo)}
          </div>

          {transactions.length === 0 ? (
            <div className="py-20 text-center text-[#777]">
              <Tags className="mx-auto mb-3 h-12 w-12" />
              <h3 className="text-[20px] font-semibold">Empty!</h3>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="w-[10%] px-2 py-2 text-left">DATE</th>
                      <th className="w-[20%] px-2 py-2 text-left">CUSTOMER</th>
                      <th className="w-[20%] px-2 py-2 text-left">TERMS</th>
                      <th className="w-[15%] px-2 py-2 text-left">REF #</th>
                      <th className="w-[15%] px-2 py-2 text-left">SO#</th>
                      <th className="w-[15%] px-2 py-2 text-left">Amount</th>
                      <th className="w-[15%] px-2 py-2 text-left">DR</th>
                      <th className="w-[15%] px-2 py-2 text-left">INVOICE</th>
                      <th className="w-[15%] px-2 py-2 text-left">SALESPERSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={`${transaction.type}-${transaction.id}`} className="border-t border-[#ddd]">
                        <td className="px-2 py-2">{formatRowDate(transaction.date)}</td>
                        <td className="px-2 py-2">{transaction.customer}</td>
                        <td className="px-2 py-2">{transaction.terms}</td>
                        <td className="px-2 py-2">{transaction.refNo}</td>
                        <td className="px-2 py-2">{transaction.soNo}</td>
                        <td className="px-2 py-2">{money.format(transaction.soAmount || 0)}</td>
                        <td className="px-2 py-2">{money.format(transaction.drAmount || 0)}</td>
                        <td className="px-2 py-2">{money.format(transaction.invoiceAmount || 0)}</td>
                        <td className="px-2 py-2">{transaction.salesperson}</td>
                      </tr>
                    ))}

                    {reportType !== 'today' && (
                      <tr>
                        <td />
                        <td colSpan={2} className="px-2 py-2 font-semibold">TOTAL </td>
                        <td colSpan={2} />
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.soAmount || 0)}</td>
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.drAmount || 0)}</td>
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.invoiceAmount || 0)}</td>
                        <td />
                      </tr>
                    )}

                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">SUBTOTAL --&gt;</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.soAmount || 0)}</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.drAmount || 0)}</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.invoiceAmount || 0)}</td>
                      <td />
                    </tr>

                    {reportType !== 'today' && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">TOTAL  --&gt;</td>
                        <td />
                        <td colSpan={2} className="px-2 py-3 text-center font-semibold">{money.format(reportData?.summary.grandTotal.total || 0)}</td>
                        <td />
                      </tr>
                    )}
                    <tr>
                      <td colSpan={6} />
                      <td colSpan={2} className="border-t border-black" />
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">GRAND TOTAL --&gt;</td>
                      <td />
                      <td colSpan={2} className="border-b-4 border-double border-black px-2 py-3 text-center font-semibold">{money.format(reportData?.summary.grandTotal.total || 0)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                <div>
                  {reportType !== 'today' && (
                    <table className="w-full border-collapse text-[12px]" data-testid="salesperson-category-summary">
                      <tbody>
                        {(reportData?.summary.salespersonTotals || []).map(salesperson => (
                          <React.Fragment key={salesperson.salesperson}>
                            <tr><td className="px-2 py-2">{salesperson.salesperson}</td><td /><td /></tr>
                            {salesperson.categories.map(category => (
                              <tr key={`${salesperson.salesperson}-${category.category}`}>
                                <td />
                                <td className="px-2 py-2">{category.category}</td>
                                <td className="px-2 py-2 text-right">{money.format(category.soAmount + category.drAmount + category.invoiceAmount)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={2} className="border-b border-black" />
                              <td className="border-y border-black px-2 py-2 text-right">{money.format(salesperson.total)}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                        <tr><td colSpan={3} className="border-b border-black" /></tr>
                        <tr>
                          <td colSpan={2} className="border-b border-black px-2 py-2">TOTAL</td>
                          <td className="border-b border-black px-2 py-2 text-right">{money.format(salespersonGrandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="text-[12px]">
                  <p className="font-semibold">Checked and Audited by/ Date: </p>
                  <p className="mb-4">______________________________________</p>
                  <p className="font-semibold">Noted by/ Date: </p>
                  <p>______________________________________</p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SalesReportDataView;
