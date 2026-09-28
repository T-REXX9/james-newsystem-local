import React from 'react';
import { Loader2, History } from 'lucide-react';
import { UserProfile } from '../types';

export interface AgentAssignmentHistoryItem {
  agentId: string;
  agentName: string;
  assignedByName?: string;
  assignedAt: string;
}

interface DailyCallInlineAgentSelectProps {
  customerId: string;
  shopName: string;
  assignedTo: string;
  assignedAgentId?: string;
  assignedDate?: string;
  agents: UserProfile[];
  loadingAgents?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onAssign: (customerId: string, agent: UserProfile | null) => void | Promise<void>;
  /** Lazily load this customer's assignment history (called on first focus). */
  fetchHistory?: (customerId: string) => Promise<AgentAssignmentHistoryItem[]>;
}

export const resolveInlineAgentSelectValue = (
  assignedTo: string,
  assignedAgentId: string | undefined,
  agents: UserProfile[]
): string => {
  const normalizedAgentId = String(assignedAgentId || '').trim();
  if (normalizedAgentId && agents.some((agent) => agent.id === normalizedAgentId)) {
    return normalizedAgentId;
  }

  const normalizedName = String(assignedTo || '').trim().toLowerCase();
  if (normalizedName && normalizedName !== 'unassigned') {
    const matched = agents.find((agent) => agent.full_name.trim().toLowerCase() === normalizedName);
    if (matched) return matched.id;
  }

  return '';
};

export const formatAssignmentDateLabel = (value = new Date()): string =>
  value.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase();

/** Format a stored assignment timestamp ('2026-09-26 10:16:34') as 'Sep 2026'. */
export const formatHistoryDate = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
};

const DailyCallInlineAgentSelect: React.FC<DailyCallInlineAgentSelectProps> = ({
  customerId,
  shopName,
  assignedTo,
  assignedAgentId,
  assignedDate,
  agents,
  loadingAgents = false,
  saving = false,
  disabled = false,
  onAssign,
  fetchHistory,
}) => {
  const selectedAgentId = resolveInlineAgentSelectValue(assignedTo, assignedAgentId, agents);
  const isAssigned = Boolean(selectedAgentId);
  const showHighlightedDate = isAssigned && assignedDate && assignedDate !== '—';

  const [history, setHistory] = React.useState<AgentAssignmentHistoryItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const loadedRef = React.useRef(false);

  const loadHistory = React.useCallback(async () => {
    if (!fetchHistory || loadedRef.current) return;
    loadedRef.current = true;
    setLoadingHistory(true);
    try {
      setHistory(await fetchHistory(customerId));
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [fetchHistory, customerId]);

  // Re-fetch history after a successful (re)assignment so the list stays current.
  const prevSaving = React.useRef(saving);
  React.useEffect(() => {
    if (prevSaving.current && !saving && loadedRef.current && fetchHistory) {
      loadedRef.current = false;
      void loadHistory();
    }
    prevSaving.current = saving;
  }, [saving, fetchHistory, loadHistory]);

  const hasMultiple = (history?.length ?? 0) > 1;

  return (
    <div className="min-w-0 space-y-1">
      <div className="relative">
        <select
          aria-label={`Assign sales agent for ${shopName}`}
          value={selectedAgentId}
          disabled={disabled || saving || loadingAgents}
          onFocus={() => { void loadHistory(); }}
          onClick={(event) => { event.stopPropagation(); void loadHistory(); }}
          onChange={(event) => {
            event.stopPropagation();
            const nextAgentId = event.target.value;
            if (nextAgentId === selectedAgentId) return;
            const nextAgent = agents.find((agent) => agent.id === nextAgentId) || null;
            void onAssign(customerId, nextAgent);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 pr-7 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.full_name}
              {history?.find((h) => h.agentId === agent.id)
                ? ` — assigned ${formatHistoryDate(history.find((h) => h.agentId === agent.id)!.assignedAt)}`
                : ''}
            </option>
          ))}
        </select>
        {(saving || loadingAgents) && (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>
      {showHighlightedDate ? (
        <p
          className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
          title={`Assigned on ${assignedDate}`}
        >
          Assigned {assignedDate}
        </p>
      ) : (
        <p className="text-[10px] font-medium text-slate-400">No assignment date</p>
      )}
      {loadingHistory && (
        <p className="text-[10px] font-medium text-slate-400">Loading history…</p>
      )}
      {history && history.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <History className="h-3 w-3" />
            {hasMultiple
              ? `Assigned to ${history.length} agents`
              : 'Assignment history'}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {history.map((entry, index) => (
              <li
                key={`${entry.agentId}-${entry.assignedAt}-${index}`}
                className="flex items-baseline justify-between gap-2 text-[10px] text-slate-600"
              >
                <span className="truncate font-semibold text-slate-700">
                  {entry.agentName || `Agent #${entry.agentId}`}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatHistoryDate(entry.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DailyCallInlineAgentSelect;
