import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CallRecord, fetchCallRecords } from '../services/callingSystemService';
import { UserProfile } from '../types';

interface CallRecordsViewProps {
  currentUser: UserProfile | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatDate = (timestamp: string): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp.replace(' ', 'T') + (timestamp.includes('T') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
};

const formatTime = (timestamp: string): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp.replace(' ', 'T') + (timestamp.includes('T') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDirection = (direction: string): string => {
  if (direction === 'outbound') return 'Outgoing';
  if (direction === 'inbound') return 'Incoming';
  if (direction === 'missed') return 'Missed';
  return direction || 'Unknown';
};

const formatDuration = (seconds: number | string): string => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value === 0) return '—';
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
};

const formatStaffName = (record: CallRecord): string => {
  const first = (record.agent_first_name || '').trim();
  const last = (record.agent_last_name || '').trim();
  const name = `${first} ${last}`.trim();
  return name || `Staff #${record.lagent_id}`;
};

const DIRECTION_FILTERS: Array<{ id: string; label: string }> = [
  { id: '', label: 'All' },
  { id: 'outbound', label: 'Outgoing' },
  { id: 'inbound', label: 'Incoming' },
  { id: 'missed', label: 'Missed' },
];

const CallRecordsView: React.FC<CallRecordsViewProps> = ({ currentUser }) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [direction, setDirection] = useState('');
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await fetchCallRecords({ month, year, direction: direction || undefined });
      setRecords(data);
    } catch (error) {
      toast.error('Unable to load call records', {
        description: error instanceof Error ? error.message : 'Check the API connection and staff session.',
      });
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, direction]);

  useEffect(() => {
    setLoading(true);
    void load(false);
  }, [load]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const summary = useMemo(() => {
    const total = records.length;
    const withReport = records.filter((r) => (r.concern && r.concern.trim()) || (r.action && r.action.trim())).length;
    const withoutReport = total - withReport;
    return { total, withReport, withoutReport };
  }, [records]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      {/* Fixed header: title, month picker, filters, summary */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Call Records</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Month picker */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[8rem] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Direction filter */}
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {DIRECTION_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>{summary.total} calls</span>
          <span className="text-emerald-600">{summary.withReport} documented</span>
          <span className="text-rose-500">{summary.withoutReport} without report</span>
        </div>
      </header>

      {/* Fixed column headers + scrollable rows */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Column headers - fixed, never scroll */}
        <div className="shrink-0 overflow-hidden border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid w-full grid-cols-[5rem_5rem_1fr_7rem_1.4fr_1.4fr_7rem] gap-1 px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <div>Date</div>
            <div>Time</div>
            <div>Customer</div>
            <div>Contact</div>
            <div>Concern</div>
            <div>Action</div>
            <div>Remarks</div>
          </div>
        </div>

        {/* Scrollable row list - only this scrolls, vertically only */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading call records…
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No call records for {MONTH_NAMES[month - 1]} {year}.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.map((record) => {
                const customerName = (record.customer_company || '').trim();
                const concern = (record.concern || '').trim();
                const action = (record.action || '').trim();
                const hasReport = concern !== '' || action !== '';
                return (
                  <div
                    key={String(record.lid)}
                    className={`grid w-full grid-cols-[5rem_5rem_1fr_7rem_1.4fr_1.4fr_7rem] gap-1 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 ${hasReport ? '' : 'bg-rose-50/40 dark:bg-rose-950/20'}`}
                  >
                    <div className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                      {formatDate(record.lcall_timestamp)}
                    </div>
                    <div className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatTime(record.lcall_timestamp)}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="block truncate font-semibold" title={customerName}>
                        {customerName || <span className="text-slate-400">—</span>}
                      </span>
                      <span className="block text-[10px] text-slate-400">{formatDirection(record.ldirection)} · {formatDuration(record.lduration_seconds)}</span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="block truncate font-mono text-[11px] text-slate-500 dark:text-slate-400" title={record.lphone_number}>
                        {record.lphone_number || '—'}
                      </span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="block whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400" title={concern}>
                        {concern || <span className="text-slate-400">—</span>}
                      </span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="block whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400" title={action}>
                        {action || <span className="text-slate-400">—</span>}
                      </span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="block truncate font-semibold text-slate-700 dark:text-slate-200" title={formatStaffName(record)}>
                        {formatStaffName(record)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallRecordsView;
