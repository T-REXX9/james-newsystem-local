import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Phone, RefreshCw } from 'lucide-react';
import { fetchHardwareCallLogs, HardwareCallLog } from '../services/callingSystemService';

interface CustomerCallHistoryCardProps {
  customerId: string | number;
}

const formatDate = (value: string) => {
  const parsed = new Date(String(value || '').replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatDuration = (value: number | string) => {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const directionLabel = (direction: string) => {
  if (direction === 'missed') return 'Missed incoming';
  if (direction === 'inbound') return 'Incoming';
  if (direction === 'outbound') return 'Outgoing';
  return direction || 'Unknown';
};

const CustomerCallHistoryCard: React.FC<CustomerCallHistoryCardProps> = ({ customerId }) => {
  const [logs, setLogs] = useState<HardwareCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await fetchHardwareCallLogs({ customerId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this customer’s call history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [customerId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div><h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white"><Phone className="h-4 w-4 text-brand-blue" /> Hardware call history</h3><p className="mt-1 text-xs text-slate-500">Inbound, outbound, and missed-call metadata linked to this customer.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Refresh</button>
      </div>
      {loading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Loading call history…</div> : error ? <div role="alert" className="p-8 text-center text-sm text-rose-600">{error}</div> : logs.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No hardware call history for this customer.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Direction</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Staff</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{logs.map((log) => <tr key={String(log.lid)}><td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(log.lcall_timestamp)}</td><td className="px-5 py-3"><span className="inline-flex items-center gap-1.5">{log.ldirection === 'inbound' || log.ldirection === 'missed' ? <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" /> : <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}{directionLabel(log.ldirection)}</span></td><td className="px-5 py-3">{log.lphone_number}</td><td className="px-5 py-3">{formatDuration(log.lduration_seconds)}</td><td className="px-5 py-3">{`${log.agent_first_name || ''} ${log.agent_last_name || ''}`.trim() || `Staff #${log.lagent_id}`}</td></tr>)}</tbody></table></div>}
    </div>
  );
};

export default CustomerCallHistoryCard;
