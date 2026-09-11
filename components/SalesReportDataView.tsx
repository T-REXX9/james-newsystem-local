import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
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

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase();
};

type PaymentTermBucket = {
  label: string;
  category: 'cash' | 'terms';
  key: string;
  soAmount: number;
  drAmount: number;
  invoiceAmount: number;
};

const CASH_TERM_LABELS: Record<string, string> = {
  'ap/ttpnb': 'AP/TT-PNB',
  lbccod: 'LBC COD',
  lbccop: 'LBC COP',
};

const normalizePaymentTerm = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9/]+/g, '');

const getPaymentTermLabel = (value: string): { key: string; label: string; category: PaymentTermBucket['category'] } => {
  const normalized = normalizePaymentTerm(value);
  const cashLabel = CASH_TERM_LABELS[normalized];
  if (cashLabel) return { key: normalized, label: cashLabel, category: 'cash' };

  const dayTerm = normalized.match(/^(\d+)\s*days?$/);
  if (dayTerm) return { key: `days:${dayTerm[1]}`, label: `${dayTerm[1]} DAYS`, category: 'terms' };

  const displayLabel = value.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return { key: normalized || 'unspecified', label: displayLabel || 'UNSPECIFIED TERMS', category: 'terms' };
};

const getPaymentTermBuckets = (transactions: SalesReportTransaction[]): PaymentTermBucket[] => {
  const buckets = new Map<string, PaymentTermBucket>([
    ['cash:ap/ttpnb', { key: 'ap/ttpnb', label: 'AP/TT-PNB', category: 'cash', soAmount: 0, drAmount: 0, invoiceAmount: 0 }],
    ['cash:lbccod', { key: 'lbccod', label: 'LBC COD', category: 'cash', soAmount: 0, drAmount: 0, invoiceAmount: 0 }],
    ['cash:lbccop', { key: 'lbccop', label: 'LBC COP', category: 'cash', soAmount: 0, drAmount: 0, invoiceAmount: 0 }],
  ]);

  transactions.forEach(transaction => {
    const { key: termKey, label, category } = getPaymentTermLabel(transaction.terms);
    const key = `${category}:${termKey}`;
    const current = buckets.get(key) || { key: termKey, label, category, soAmount: 0, drAmount: 0, invoiceAmount: 0 };
    current.soAmount += transaction.soAmount || 0;
    current.drAmount += transaction.drAmount || 0;
    current.invoiceAmount += transaction.invoiceAmount || 0;
    buckets.set(key, current);
  });

  return Array.from(buckets.values());
};

const displayReportHeading = (reportType: SalesReportPeriod, dateFrom: string, dateTo: string) => {
  const from = new Date(dateFrom);
  const fromLong = from.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase().toUpperCase();
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

  const paymentTermBuckets = useMemo(
    () => getPaymentTermBuckets(transactions),
    [transactions],
  );

  const cashPaymentTermBuckets = paymentTermBuckets.filter(bucket => bucket.category === 'cash');
  const termPaymentTermBuckets = paymentTermBuckets.filter(bucket => bucket.category === 'terms');

  const sumPaymentTermBuckets = (buckets: PaymentTermBucket[]): PaymentTermBucket => buckets.reduce(
    (total, bucket) => ({
      label: '',
      category: total.category,
      key: '',
      soAmount: total.soAmount + bucket.soAmount,
      drAmount: total.drAmount + bucket.drAmount,
      invoiceAmount: total.invoiceAmount + bucket.invoiceAmount,
    }),
    { label: '', category: 'terms', key: '', soAmount: 0, drAmount: 0, invoiceAmount: 0 },
  );

  const cashTotal = sumPaymentTermBuckets(cashPaymentTermBuckets);
  const termsTotal = sumPaymentTermBuckets(termPaymentTermBuckets);
  const paymentTermsTotal = sumPaymentTermBuckets(paymentTermBuckets);

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

                  <tr data-testid="payment-terms-breakdown">
                    <td colSpan={9} className="pt-5">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-black">
                            <th colSpan={2} className="px-2 py-2 text-left">PAYMENT TERMS BREAKDOWN</th>
                            <th className="px-2 py-2 text-right">Amount</th>
                            <th className="px-2 py-2 text-right">DR</th>
                            <th className="px-2 py-2 text-right">INVOICE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={5} className="px-2 pt-3 font-semibold">CASH SALES</td>
                          </tr>
                          {cashPaymentTermBuckets.map(bucket => (
                            <tr key={`cash-${bucket.label}`}>
                              <td colSpan={2} className="px-2 py-[5px]">{bucket.label}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.soAmount)}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.drAmount)}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.invoiceAmount)}</td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={2} className="px-2 py-2 text-right font-semibold">CASH SALES TOTAL</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(cashTotal.soAmount)}</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(cashTotal.drAmount)}</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(cashTotal.invoiceAmount)}</td>
                          </tr>
                          <tr>
                            <td colSpan={5} className="px-2 pt-3 font-semibold">TERMS SALES</td>
                          </tr>
                          {termPaymentTermBuckets.map(bucket => (
                            <tr key={`terms-${bucket.label}`}>
                              <td colSpan={2} className="px-2 py-[5px]">{bucket.label}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.soAmount)}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.drAmount)}</td>
                              <td className="px-2 py-[5px] text-right">{money.format(bucket.invoiceAmount)}</td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={2} className="px-2 py-2 text-right font-semibold">TERMS SALES TOTAL</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(termsTotal.soAmount)}</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(termsTotal.drAmount)}</td>
                            <td className="border-y border-black px-2 py-2 text-right font-semibold">{money.format(termsTotal.invoiceAmount)}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="px-2 py-3 text-right text-[13px] font-semibold">PAYMENT TERMS TOTAL</td>
                            <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(paymentTermsTotal.soAmount)}</td>
                            <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(paymentTermsTotal.drAmount)}</td>
                            <td className="border-y border-black px-2 py-3 text-right font-semibold">{money.format(paymentTermsTotal.invoiceAmount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
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
