import React, { useEffect, useMemo } from 'react';
import { Phone, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import { OperationsCallDetail } from '../services/operationsDashboardService';

export type OperationsCallBreakdownKind = 'incoming' | 'outgoing' | 'missed' | 'returned' | 'unanswered';

interface OperationsCallBreakdownModalProps {
  date: string;
  details: OperationsCallDetail[];
  kind: OperationsCallBreakdownKind;
  onClose: () => void;
}

const labels: Record<OperationsCallBreakdownKind, string> = {
  incoming: 'Incoming Calls',
  outgoing: 'Outgoing Calls',
  missed: 'Missed Calls',
  returned: 'Returned Calls',
  unanswered: 'Unanswered Calls',
};

const matchesKind = (detail: OperationsCallDetail, kind: OperationsCallBreakdownKind) => {
  if (kind === 'incoming') return detail.direction === 'inbound';
  if (kind === 'outgoing') return detail.direction === 'outbound';
  if (kind === 'missed') return detail.direction === 'missed';
  if (kind === 'unanswered') return detail.direction === 'outbound' && detail.durationSeconds === 0;
  return false;
};

const directionLabel = (direction: string) => {
  if (direction === 'inbound') return 'Incoming';
  if (direction === 'outbound') return 'Outgoing';
  if (direction === 'missed') return 'Missed incoming';
  return direction || 'Unknown';
};

const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.round(seconds || 0));
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const OperationsCallBreakdownModal: React.FC<OperationsCallBreakdownModalProps> = ({ date, details, kind, onClose }) => {
  const rows = useMemo(() => details.filter((detail) => matchesKind(detail, kind)), [details, kind]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="operations-call-breakdown-title" className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Call breakdown · {date}</p>
            <h2 id="operations-call-breakdown-title" className="mt-1 text-xl font-black text-[#101b45]">{labels[kind]}</h2>
            <p className="mt-1 text-xs text-slate-500">{rows.length} {rows.length === 1 ? 'record' : 'records'} found</p>
          </div>
          <button type="button" aria-label="Close call breakdown" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-auto p-3 sm:p-5">
          {rows.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
              <div><Phone className="mx-auto mb-2 h-8 w-8 text-slate-400" /><p className="font-bold text-slate-700">No {labels[kind].toLowerCase()} recorded</p><p className="mt-1 text-xs text-slate-500">There are no matching hardware calls for this date.</p></div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Customer / Number</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Time</th><th className="px-4 py-3 text-right">Duration</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((detail) => {
                    const isSaved = Boolean(detail.customerId);
                    const customerLabel = detail.customerName || detail.customerCode || (isSaved ? `Customer #${detail.customerId}` : detail.phoneNumber || 'Unknown number');
                    return <tr key={detail.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><div className="flex items-start gap-2.5">{isSaved ? <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />}<div><strong className="block text-slate-900">{customerLabel}</strong>{(isSaved || customerLabel !== detail.phoneNumber) && <span className="block text-xs text-slate-500">{detail.phoneNumber || 'No mobile number'}</span>}<span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${isSaved ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>{isSaved ? 'Saved customer' : 'Unsaved number'}</span></div></div></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{detail.agentName}</td>
                      <td className="px-4 py-3 text-slate-700">{directionLabel(detail.direction)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{formatTime(detail.occurredAt)}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{formatDuration(detail.durationSeconds)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OperationsCallBreakdownModal;
