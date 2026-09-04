import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  fetchCallReportThreads,
  markCallReportThreadRead,
  sendCallReportReply,
} from '../services/dailyCallMonitoringService';
import { CallOutcome, CallReportThread, UserProfile } from '../types';
import { useToast } from './ToastProvider';

interface CallReportActivityPanelProps {
  contactId: string;
  currentUser: UserProfile | null;
  assignedAgentName?: string;
  compact?: boolean;
}

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  note: 'Conversation completed',
  positive: 'Positive / interested',
  follow_up: 'Follow-up required',
  negative: 'Not interested',
  other: 'Other outcome',
};

const isMasterUser = (user: UserProfile | null): boolean => {
  if (!user) return false;
  if (String(user.user_type) === '1') return true;
  const role = String(user.role || '').toLowerCase();
  return ['master user', 'company owner', 'owner', 'main', 'developer'].includes(role);
};

const formatTimestamp = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatDuration = (seconds: number) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value <= 0) return '—';
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
};

const formatCallDetails = (thread: CallReportThread) => {
  const started = thread.call_started_at ? formatTimestamp(thread.call_started_at) : null;
  const ended = thread.call_ended_at ? formatTimestamp(thread.call_ended_at) : null;
  const duration = formatDuration(thread.duration_seconds);

  if (!started && !ended && duration === '—') {
    return null;
  }

  return { started, ended, duration };
};

const CallReportActivityPanel: React.FC<CallReportActivityPanelProps> = ({
  contactId,
  currentUser,
  assignedAgentName,
  compact = false,
}) => {
  const { addToast } = useToast();
  const [threads, setThreads] = useState<CallReportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingThreadId, setSubmittingThreadId] = useState<string | null>(null);
  const masterUser = isMasterUser(currentUser);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchCallReportThreads(contactId);
      setThreads(rows);
      await Promise.all(
        rows
          .filter((thread) => thread.unread_count > 0)
          .map((thread) => markCallReportThreadRead(thread.id).catch(() => undefined))
      );
    } catch (error) {
      console.error('Error loading call report threads:', error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to load sales agent reports.',
      });
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, contactId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const visibleThreads = useMemo(
    () => (compact ? threads.slice(0, 3) : threads),
    [compact, threads]
  );

  const handleReplyChange = (threadId: string, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [threadId]: value }));
  };

  const handleSubmitReply = async (threadId: string) => {
    const body = (replyDrafts[threadId] || '').trim();
    if (!body) return;

    setSubmittingThreadId(threadId);
    try {
      const message = await sendCallReportReply({
        threadId,
        body,
        senderName: currentUser?.full_name || currentUser?.email || 'Master User',
      });
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, messages: [...thread.messages, message], last_activity_at: message.created_at }
            : thread
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }));
      addToast({ type: 'success', message: 'Reply sent to the sales agent.' });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to send reply.',
      });
    } finally {
      setSubmittingThreadId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading sales agent reports…</span>
      </div>
    );
  }

  if (visibleThreads.length === 0) {
    return (
      <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-500">
        No sales-agent report has been recorded for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleThreads.map((thread) => {
        const replyDraft = replyDrafts[thread.id] || '';
        const outcomeLabel = OUTCOME_LABELS[thread.outcome] || thread.outcome;
        const callDetails = formatCallDetails(thread);

        return (
          <section key={thread.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">{thread.agent_name || assignedAgentName || 'Sales Agent'}</p>
                <p className="text-[10px] text-slate-500">Report submitted {formatTimestamp(thread.created_at)}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                {outcomeLabel}
              </span>
            </header>

            {callDetails && (
              <div className="grid gap-1 border-b border-slate-200 bg-slate-100/70 px-3 py-2 text-[10px] text-slate-600 sm:grid-cols-3">
                {callDetails.started && (
                  <p><span className="font-semibold text-slate-700">Call started:</span> {callDetails.started}</p>
                )}
                {callDetails.ended && (
                  <p><span className="font-semibold text-slate-700">Call ended:</span> {callDetails.ended}</p>
                )}
                {callDetails.duration !== '—' && (
                  <p><span className="font-semibold text-slate-700">Duration:</span> {callDetails.duration}</p>
                )}
              </div>
            )}

            <div className="space-y-3 p-3">
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Sales agent report</p>
                  <p className="whitespace-pre-wrap leading-6">{thread.report_body}</p>
                </div>
              </div>

              {thread.messages.map((message) => {
                const isMine = message.is_from_current_user;
                return (
                  <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        isMine
                          ? 'bg-brand-blue text-white'
                          : message.is_from_master
                            ? 'border border-violet-200 bg-violet-50 text-slate-900'
                            : 'border border-slate-200 bg-white text-slate-900'
                      }`}
                    >
                      <p className={`mb-1 text-[10px] font-semibold ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                        {isMine ? 'You' : message.sender_name}
                      </p>
                      <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                      <p className={`mt-2 text-[10px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                        {formatTimestamp(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {masterUser && !compact && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Reply to this report</span>
                    <textarea
                      value={replyDraft}
                      onChange={(event) => handleReplyChange(thread.id, event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Write a reply for the sales agent..."
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </label>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={!replyDraft.trim() || submittingThreadId === thread.id}
                      onClick={() => void handleSubmitReply(thread.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingThreadId === thread.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {compact && threads.length > visibleThreads.length && (
        <p className="text-center text-[11px] font-semibold text-slate-500">
          {threads.length - visibleThreads.length} more report{threads.length - visibleThreads.length === 1 ? '' : 's'} available in the full view.
        </p>
      )}
    </div>
  );
};

export default CallReportActivityPanel;
