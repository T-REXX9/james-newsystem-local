import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Sheet, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import {
  fetchCustomersForDailyCall,
  getWeeklyRangeBuckets,
  subscribeToDailyCallMonitoringUpdates,
} from '../services/dailyCallMonitoringService';
import { DailyCallCustomerFilterStatus, DailyCallCustomerRow, UserProfile } from '../types';
import { useToast } from './ToastProvider';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';

interface DailyCallExcelFormatViewProps {
  currentUser: UserProfile | null;
}

const statusFilters: Array<{ id: DailyCallCustomerFilterStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive+' },
  { id: 'prospective', label: 'Prospective+' },
];

const rowHeightPx = 52;
const viewportHeightPx = 530;
const dayColumnPageSize = 10;

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const getMonthDays = () => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => index + 1);
};

const DailyCallExcelFormatView: React.FC<DailyCallExcelFormatViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<DailyCallCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DailyCallCustomerFilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [dayPage, setDayPage] = useState(0);

  const debouncedSearch = useDebounce(search, 300);
  const monthDays = useMemo(() => getMonthDays(), []);
  const weeklyRangeBuckets = useMemo(() => getWeeklyRangeBuckets(), []);

  const totalDayPages = Math.max(1, Math.ceil(monthDays.length / dayColumnPageSize));
  const pagedDays = useMemo(() => {
    const start = dayPage * dayColumnPageSize;
    return monthDays.slice(start, start + dayColumnPageSize);
  }, [dayPage, monthDays]);

  const loadRows = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setLoading(true);
      }

      setError(null);
      const rows = await fetchCustomersForDailyCall({
        status: statusFilter,
        search: debouncedSearch,
      });

      setCustomers(rows);
      if (withLoading) setLoading(false);
    },
    [debouncedSearch, statusFilter]
  );

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const unsubscribe = subscribeToDailyCallMonitoringUpdates({
      onInsert: () => loadRows(false),
      onUpdate: () => loadRows(false),
      onDelete: () => loadRows(false),
      onError: () => {
        setError('Unable to sync realtime updates.');
      },
    });

    return unsubscribe;
  }, [loadRows]);

  useEffect(() => {
    setDayPage(0);
  }, [statusFilter]);

  useEffect(() => {
    const selectedExists = customers.some((row) => row.id === selectedCustomerId);
    if (!selectedExists) {
      setSelectedCustomerId(null);
      setIsDetailModalOpen(false);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const getActivityLabel = (row: DailyCallCustomerRow, day: number) => {
    const entry = row.dailyActivity.find((activity) => {
      const parsed = new Date(activity.activity_date);
      return parsed.getDate() === day;
    });

    if (!entry) return '-';
    return entry.activity_count > 1 ? `${entry.activity_count}` : entry.activity_type === 'call' ? 'C' : 'T';
  };

  const runRetry = async () => {
    setError(null);
    try {
      await loadRows();
      addToast({ type: 'success', title: 'Refreshed', description: 'Customer data updated.' });
    } catch {
      setError('Unable to refresh data.');
    }
  };

  const handleCloseModal = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedCustomerId(null);
  }, []);

  const columnCount = 16 + weeklyRangeBuckets.length + pagedDays.length;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading daily call records...
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Sheet className="h-4 w-4 text-blue-600" />
            Excel-format customer monitoring
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, city, contact"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const isActive = filter.id === statusFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </span>
          <button
            type="button"
            onClick={runRetry}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-70" />
          <p className="font-semibold">No customers found for this view.</p>
          <p className="mt-1 text-xs">Try adjusting the status filter or search query.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {customers.length} customer{customers.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDayPage((prev) => Math.max(0, prev - 1))}
                disabled={dayPage === 0}
                className="rounded-md border border-slate-300 p-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-500">
                Days {dayPage * dayColumnPageSize + 1}-{Math.min(monthDays.length, (dayPage + 1) * dayColumnPageSize)}
              </span>
              <button
                type="button"
                onClick={() => setDayPage((prev) => Math.min(totalDayPages - 1, prev + 1))}
                disabled={dayPage >= totalDayPages - 1}
                className="rounded-md border border-slate-300 p-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable_both-edges]"
            style={{ overscrollBehaviorX: 'contain', overflowAnchor: 'none' }}
          >
            <div
              className="w-max min-w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              style={{ height: `${viewportHeightPx}px`, overscrollBehaviorY: 'contain', overflowAnchor: 'none' }}
            >
            <table className="min-w-[1600px] table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-700">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900">
                    SHOP NAME
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">SOURCE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ASSIGNED TO/DATE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">CLIENT SINCE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">CITY</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">CONTACT NUMBER</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">CODE/DATE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ISHINOMOTO DEALER SINCE</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">QUOTA</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ISHINOMOTO SIGNAGE SINCE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">MODE OF PAYMENT</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">COURIER</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">STATUS</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">OUTSTANDING BALANCE</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">AVERAGE MONTHLY ORDER</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">MONTHLY ORDER</th>
                  {weeklyRangeBuckets.map((bucket) => (
                    <th key={bucket.label} className="px-2 py-2 text-center font-semibold text-slate-600">
                      {bucket.label}
                    </th>
                  ))}
                  {pagedDays.map((day) => (
                    <th key={day} className="px-2 py-2 text-center font-semibold text-slate-600">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((row) => {
                  const isSelected = selectedCustomerId === row.id;
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedCustomerId(row.id);
                        setIsDetailModalOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedCustomerId(row.id);
                          setIsDetailModalOpen(true);
                        }
                      }}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-slate-800/50'}`}
                      style={{ height: `${rowHeightPx}px` }}
                    >
                      <td className="sticky left-0 z-[1] border-r border-slate-100 bg-inherit px-3 py-2 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                        {row.shopName}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.source}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <div className="font-medium text-slate-700 dark:text-slate-200">{row.assignedTo}</div>
                        <div className="text-[11px] text-slate-500">{row.assignedDate || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.clientSince}</td>
                      <td className="px-3 py-2 text-slate-600">{row.city}</td>
                      <td className="px-3 py-2 text-slate-600">{row.contactNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{row.codeDate}</td>
                      <td className="px-3 py-2 text-slate-600">{row.ishinomotoDealerSince}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{row.quota.toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600">{row.ishinomotoSignageSince}</td>
                      <td className="px-3 py-2 text-slate-600">{row.modeOfPayment}</td>
                      <td className="px-3 py-2 text-slate-600">{row.courier}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">{toCurrency(row.outstandingBalance)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{toCurrency(row.averageMonthlyOrder)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">{toCurrency(row.monthlyOrder)}</td>
                      {weeklyRangeBuckets.map((bucket, index) => (
                        <td key={`${row.id}-${bucket.label}`} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-600">
                          {(row.weeklyRangeTotals[index] ?? 0).toLocaleString()}
                        </td>
                      ))}
                      {pagedDays.map((day) => (
                        <td key={`${row.id}-${day}`} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-600">
                          {getActivityLabel(row, day)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedCustomer && (
        <DailyCallCustomerDetailModal
          isOpen={isDetailModalOpen}
          customer={selectedCustomer}
          currentUser={currentUser}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default DailyCallExcelFormatView;
