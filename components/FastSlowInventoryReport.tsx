import React, { useCallback, useState } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { generateFastSlowReport } from '../services/inventoryMovementService';
import type { FastSlowMovementItem, FastSlowReportData, FastSlowReportFilters } from '../types';

const DEFAULT_FILTERS: FastSlowReportFilters = {
  sortBy: 'part_no',
  sortDirection: 'asc',
};

const sortOptions: Array<{ value: FastSlowReportFilters['sortBy']; label: string }> = [
  { value: 'part_no', label: 'Part No.' },
  { value: 'item_code', label: 'Listing Code' },
  { value: 'description', label: 'Description' },
  { value: 'last_arrived', label: 'Last Arrived Date' },
  { value: 'total_purchase', label: 'Total Purchase' },
  { value: 'total_sold', label: 'Pcs Sold' },
];

const formatDate = (value: string | null): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
};

const FastSlowInventoryReport: React.FC = () => {
  const [reportData, setReportData] = useState<FastSlowReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FastSlowReportFilters>(DEFAULT_FILTERS);

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setReportData(await generateFastSlowReport(filters));
    } catch (requestError) {
      console.error('Error generating inventory movement report:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate the report.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleCancel = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setReportData(null);
    setError('');
  }, []);

  const renderTable = (
    items: FastSlowMovementItem[],
    title: string,
    note: string,
    startIndex: number,
  ) => (
    <table className="mb-8 w-full border-collapse text-[13px] text-[#333]">
      <thead>
        <tr>
          <td colSpan={7} className="border-b border-[#ddd] pb-2 pt-1">
            <h5 className="m-0 text-[14px] font-semibold">
              <u>{title}</u>
            </h5>
            <span>Note: </span>
            <i>{note}</i>
          </td>
        </tr>
        <tr className="border-b-2 border-[#333]">
          <th className="w-[3%] px-1 py-2 text-center">#</th>
          <th className="w-[13%] px-1 py-2 text-center">Part No.</th>
          <th className="w-[15%] px-1 py-2 text-center">Listing Code</th>
          <th className="w-[37%] px-1 py-2 text-center">Description</th>
          <th className="w-[12%] px-1 py-2 text-center">Last Arrived Date</th>
          <th className="w-[10%] px-1 py-2 text-center">Total Purchase</th>
          <th className="w-[10%] px-1 py-2 text-center">Pcs Sold</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-5 text-center italic text-[#777]">
              No records found.
            </td>
          </tr>
        ) : (
          items.map((item, index) => (
            <tr key={`${title}-${item.item_id}-${index}`}>
              <td className="px-1 py-[2px] text-right">{startIndex + index}.</td>
              <td className="px-1 py-[2px]">&nbsp;{item.part_no || 'N/A'}</td>
              <td className="px-1 py-[2px]">{item.item_code || 'N/A'}</td>
              <td className="px-1 py-[2px]">{item.description || 'N/A'}</td>
              <td className="px-1 py-[2px] text-right">{formatDate(item.first_arrival_date)}</td>
              <td className="px-1 py-[2px] text-right">{item.total_purchased}</td>
              <td className="px-1 py-[2px] text-right">{item.total_sold}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white print:p-0">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-0 print:shadow-none">
        <header className="min-h-[64px] border-b border-[#e5e5e5] px-5 print:hidden">
          <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            {reportData ? 'Inventory Movement Report View' : 'Inventory Movement Report'}
          </h1>
        </header>

        <main className="p-5">
          {error && (
            <div className="mb-5 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-[13px] text-[#a94442]">
              <strong>Oops! </strong>
              {error}
            </div>
          )}

          {!reportData && !isLoading && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleGenerateReport();
              }}
            >
              <p className="mb-10 text-[13px]">
                Field mark with (<span className="text-[#d9534f]">*</span>) is required. Press generate after you select the sorting options
              </p>

              <div className="mx-auto max-w-[900px] space-y-[15px]">
                <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                  <label htmlFor="movement-sort-field" className="text-right text-[13px] font-semibold">
                    Order By Field<span className="text-[#d9534f]">*</span>
                  </label>
                  <select
                    id="movement-sort-field"
                    value={filters.sortBy}
                    onChange={(event) => setFilters(current => ({
                      ...current,
                      sortBy: event.target.value as FastSlowReportFilters['sortBy'],
                    }))}
                    className="h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 text-[13px] shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                  <label htmlFor="movement-sort-order" className="text-right text-[13px] font-semibold">
                    Order<span className="text-[#d9534f]">*</span>
                  </label>
                  <select
                    id="movement-sort-order"
                    value={filters.sortDirection}
                    onChange={(event) => setFilters(current => ({
                      ...current,
                      sortDirection: event.target.value as FastSlowReportFilters['sortDirection'],
                    }))}
                    className="h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 text-[13px] shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>

                <div className="grid gap-4 pt-1 md:grid-cols-[220px_1fr]">
                  <span />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-[3px] border border-[#285e8e] bg-[#428bca] px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-[#3276b1]"
                    >
                      Generate Report
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-[3px] border border-[#ccc] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#333] hover:bg-[#ebebeb]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {isLoading && (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <CustomLoadingSpinner label="Loading" />
                <div className="flex items-center gap-2 text-[13px] text-[#777]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating report...
                </div>
              </div>
            </div>
          )}

          {reportData && !isLoading && (
            <>
              <div className="mb-4 flex items-center justify-between border-b border-[#eee] pb-4 print:hidden">
                <button
                  type="button"
                  onClick={() => setReportData(null)}
                  className="flex items-center gap-1 rounded-[3px] border border-[#398439] bg-[#5cb85c] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#47a447]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Options
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

              <section id="print_area" className="overflow-x-auto">
                <p className="mb-6 text-left text-[13px]">
                  <strong>FAST MOVING/SLOW MOVING ITEMS SUMMARY</strong>
                  <br />
                  <strong>
                    AS OF {new Date(reportData.generatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: '2-digit',
                      year: 'numeric',
                    }).toUpperCase()}
                  </strong>
                </p>

                {renderTable(
                  reportData.fastMovingItems,
                  'FAST MOVING',
                  'Fast moving item when sales increase every month with 3 consecutive months',
                  1,
                )}
                {renderTable(
                  reportData.slowMovingItems,
                  'SLOW MOVING',
                  'slow moving item when sales drop with 3 consecutive months or no sales at all',
                  reportData.fastMovingItems.length + 1,
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default FastSlowInventoryReport;
