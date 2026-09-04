import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import type { SalesReportData, UserProfile } from '../types';
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

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const displayReportHeading = (reportType: SalesReportPeriod, dateFrom: string, dateTo: string) => {
  const from = new Date(dateFrom);
  const fromLong = from.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  if (reportType === 'today') {
    return <><p className="text-[18px] font-semibold">DAILY SALES</p><p className="-mt-1 text-[16px] font-semibold">{fromLong}</p></>;
  }
  if (reportType === 'month') {
    return <><p className="text-[16px] font-semibold">MONTHLY SALES</p><p className="-mt-1 text-[14px]">FOR THE MONTH OF {from.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}</p></>;
  }
  return <><p className="text-[17px] font-semibold">SALES REPORT</p><p className="-mt-1 text-[15px]">DATE COVERED: {formatDate(dateFrom).toUpperCase()} TO {formatDate(dateTo).toUpperCase()}</p></>;
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
        setReportData(await getSalesReportData({ dateFrom, dateTo, customerId }));
      } finally {
        setIsLoading(false);
      }
    };
    void loadReport();
  }, [dateFrom, dateTo, customerId]);

  const transactions = useMemo(
    () => [...(reportData?.transactions || [])].sort((left, right) => (
      new Date(left.date).getTime() - new Date(right.date).getTime()
    )),
    [reportData],
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
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-0 print:shadow-none">
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
          <div className="mb-5 text-center">
            {displayReportHeading(reportType, dateFrom, dateTo)}
          </div>

          {transactions.length === 0 ? (
            <div className="py-20 text-center text-[14px] text-[#777]">No sales found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="w-[10%] px-2 py-2 text-left">DATE</th>
                    <th className="w-[20%] px-2 py-2 text-left">CUSTOMER</th>
                    <th className="w-[12%] px-2 py-2 text-left">TERMS</th>
                    <th className="w-[13%] px-2 py-2 text-left">REF #</th>
                    <th className="w-[12%] px-2 py-2 text-left">SO#</th>
                    <th className="w-[11%] px-2 py-2 text-right">Amount</th>
                    <th className="w-[9%] px-2 py-2 text-right">DR</th>
                    <th className="w-[9%] px-2 py-2 text-right">INVOICE</th>
                    <th className="w-[14%] px-2 py-2 text-left">SALESPERSON</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td className="px-2 py-[5px]">{formatDate(transaction.date)}</td>
                      <td className="px-2 py-[5px]">{transaction.customer}</td>
                      <td className="px-2 py-[5px]">{transaction.terms}</td>
                      <td className="px-2 py-[5px]">{transaction.refNo}</td>
                      <td className="px-2 py-[5px]">{transaction.soNo}</td>
                      <td className="px-2 py-[5px] text-right">{money.format(transaction.soAmount || 0)}</td>
                      <td className="px-2 py-[5px] text-right">{money.format(transaction.drAmount || 0)}</td>
                      <td className="px-2 py-[5px] text-right">{money.format(transaction.invoiceAmount || 0)}</td>
                      <td className="px-2 py-[5px]">{transaction.salesperson}</td>
                    </tr>
                  ))}

                  {(reportData?.summary.categoryTotals || []).map(category => (
                    <tr key={category.category}>
                      <td />
                      <td colSpan={4} className="px-2 py-2 text-right font-semibold">TOTAL {category.category} --&gt;</td>
                      <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(category.soAmount)}</td>
                      <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(category.drAmount)}</td>
                      <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(category.invoiceAmount)}</td>
                      <td />
                    </tr>
                  ))}

                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">SUBTOTAL --&gt;</td>
                    <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(reportData?.summary.grandTotal.soAmount || 0)}</td>
                    <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(reportData?.summary.grandTotal.drAmount || 0)}</td>
                    <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(reportData?.summary.grandTotal.invoiceAmount || 0)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SalesReportDataView;
