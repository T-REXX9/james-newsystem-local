import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, User, Activity, Calendar, Eye, X } from 'lucide-react';
import {
  activityLogsLocalApiService,
  ActivityLogRecord,
  ActivityLogUser,
} from '../../../services/activityLogsLocalApiService';
import { formatDateTime } from '../../../utils/formatUtils';

import { shouldSuppressAuthError } from '../../../services/localApiAuth';
const formatDate = (value?: string): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return formatDateTime(d);
};

const normalizeActionTone = (action: string): string => {
  const text = action.toUpperCase();
  if (text.includes('DELETE') || text.includes('CANCEL') || text.includes('UNPOST') || text.includes('DENY')) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  }
  if (text.includes('ADD') || text.includes('CREATE') || text.includes('APPROVE') || text.includes('POSTED') || text.includes('SUBMIT')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
};

const parseDeletionOriginal = (log: ActivityLogRecord): Record<string, unknown> => {
  try {
    const payload = JSON.parse(log.deletion_original_payload || '{}');
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const deletionMessageBody = (log: ActivityLogRecord): string => {
  const original = parseDeletionOriginal(log);
  const record = original.original;
  if (!record || typeof record !== 'object') return '';
  const source = record as Record<string, unknown>;
  return String(source.report_body || source.body || '');
};

const deletionSender = (log: ActivityLogRecord): string => {
  const original = parseDeletionOriginal(log);
  const record = original.original;
  if (!record || typeof record !== 'object') return 'Unknown';
  const source = record as Record<string, unknown>;
  const name = String(source.agent_name || source.sender_name || '').trim();
  const userId = String(source.agent_user_id || source.sender_user_id || '').trim();
  return name ? `${name}${userId ? ` (User #${userId})` : ''}` : (userId ? `User #${userId}` : 'Unknown');
};

const deletionCustomerName = (log: ActivityLogRecord): string => {
  if (log.deletion_customer_name.trim()) return log.deletion_customer_name.trim();
  const snapshotName = String(parseDeletionOriginal(log).customer_name || '').trim();
  return snapshotName || 'Unknown customer';
};

const deletionAuditId = (log: ActivityLogRecord): number | null => {
  const match = /^call-report-deletion-audit:(\d+)$/.exec(log.lrefno || '');
  return match ? Number(match[1]) : null;
};

interface ActivityLogsProps {
  title?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export default function ActivityLogs({ title = 'Activity Logs', initialDateFrom, initialDateTo }: ActivityLogsProps) {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [users, setUsers] = useState<ActivityLogUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userId, setUserId] = useState('All');
  const [action, setAction] = useState('All');
  const [dateFrom, setDateFrom] = useState(initialDateFrom || '');
  const [dateTo, setDateTo] = useState(initialDateTo || '');

  const [page, setPage] = useState(1);
  const [perPage] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [selectedDeletionLog, setSelectedDeletionLog] = useState<ActivityLogRecord | null>(null);
  const [loadingDeletionAuditId, setLoadingDeletionAuditId] = useState<number | null>(null);

  useEffect(() => {
    if (!initialDateFrom && !initialDateTo) return;
    setDateFrom(initialDateFrom || '');
    setDateTo(initialDateTo || '');
    setPage(1);
  }, [initialDateFrom, initialDateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadUsers = async () => {
    try {
      const rows = await activityLogsLocalApiService.users();
      setUsers(rows);
    } catch {
      setUsers([]);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await activityLogsLocalApiService.list({
        search: debouncedSearch || undefined,
        userId: userId !== 'All' ? userId : undefined,
        action: action !== 'All' ? action : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        perPage,
      });
      setLogs(data.items);
      setHasMore(Boolean(data.meta.has_more));
      setTotalRows(data.meta.total);
    } catch (err: any) {
      if (shouldSuppressAuthError(err)) return;
      setLogs([]);
      setError(err?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const openDeletionDetails = async (auditId: number) => {
    setLoadingDeletionAuditId(auditId);
    try {
      setSelectedDeletionLog(await activityLogsLocalApiService.deletionDetail(auditId));
    } catch (err: any) {
      if (!shouldSuppressAuthError(err)) setError(err?.message || 'Failed to load deletion details');
    } finally {
      setLoadingDeletionAuditId(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [debouncedSearch, userId, action, dateFrom, dateTo, page]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.user_id;
      map.set(user.user_id, name);
    });
    return map;
  }, [users]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="text-blue-600" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Audit trail from legacy `tblaudit_trail`
            {totalRows !== null ? ` (${totalRows} total)` : ' (fast mode)'}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Refresh Logs"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search page/action/ref/user..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <option value="All">All Users</option>
            {users.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.user_id}
              </option>
            ))}
          </select>

          <select
            aria-label="Activity type"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <option value="All">All Activity Types</option>
            <option value="Create">Create</option>
            <option value="Update">Update</option>
            <option value="Post">Post</option>
            <option value="Unpost">Unpost</option>
            <option value="Verify Prospect">Verify Prospect</option>
            <option value="Reject Prospect - Blacklisted">Reject Prospect - Blacklisted</option>
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Page</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Ref No</th>
                <th className="px-6 py-3 font-medium">Details</th>
                <th className="px-6 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const resolvedUser = `${log.userfname || ''} ${log.userlname || ''}`.trim() || userNameMap.get(log.luser_id) || 'Unknown';
                  const auditId = deletionAuditId(log);
                  return (
                    <tr key={`${log.lid}-${log.ldatetime}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.ldatetime)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                            <User size={12} />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{resolvedUser}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{log.lpage || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${normalizeActionTone(log.laction || '')}`}>
                          {log.laction || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs max-w-xs truncate" title={log.lrefno || ''}>
                        {log.lrefno || '-'}
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 max-w-xs">
                        {auditId !== null ? (
                          <button
                            type="button"
                            onClick={() => void openDeletionDetails(auditId)}
                            disabled={loadingDeletionAuditId === auditId}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {loadingDeletionAuditId === auditId ? 'Loading…' : 'View details'}
                          </button>
                        ) : (
                          <span className="block truncate" title={log.lreason || ''}>
                            {[log.lold_status && `${log.lold_status} → ${log.lnew_status || '-'}`, log.lreason].filter(Boolean).join(' · ') || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-emerald-700 font-semibold">Recorded</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-gray-500 dark:text-gray-400">Page {page}</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      {selectedDeletionLog && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-900/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="deleted-sales-report-details-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 id="deleted-sales-report-details-title" className="text-lg font-bold text-slate-900 dark:text-white">Deleted Agent Sales Report</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Audit #{selectedDeletionLog.deletion_audit_id}</p>
              </div>
              <button type="button" onClick={() => setSelectedDeletionLog(null)} aria-label="Close deletion details" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto p-5 text-sm">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</dt><dd className="mt-1 break-words text-slate-900 dark:text-white">{deletionCustomerName(selectedDeletionLog)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original sender</dt><dd className="mt-1 break-words text-slate-900 dark:text-white">{deletionSender(selectedDeletionLog)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deleted by</dt><dd className="mt-1 break-words text-slate-900 dark:text-white">{selectedDeletionLog.deletion_actor_name || 'Unknown'}{selectedDeletionLog.deletion_actor_role ? ` · ${selectedDeletionLog.deletion_actor_role}` : ''}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deleted at</dt><dd className="mt-1 break-words text-slate-900 dark:text-white">{formatDate(selectedDeletionLog.deletion_deleted_at || selectedDeletionLog.ldatetime)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record</dt><dd className="mt-1 break-words text-slate-900 dark:text-white">{selectedDeletionLog.deletion_record_type || 'message'} · Thread #{selectedDeletionLog.deletion_thread_id || '—'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-900 dark:text-white">{selectedDeletionLog.deletion_reason || '—'}</dd></div>
              </dl>
              <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deleted message</h3>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm text-slate-900 dark:bg-slate-800 dark:text-white">{deletionMessageBody(selectedDeletionLog) || 'No text content was recorded.'}</pre>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
