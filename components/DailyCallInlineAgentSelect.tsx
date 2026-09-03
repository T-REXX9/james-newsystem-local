import React from 'react';
import { Loader2 } from 'lucide-react';
import { UserProfile } from '../types';

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
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
}) => {
  const selectedAgentId = resolveInlineAgentSelectValue(assignedTo, assignedAgentId, agents);
  const isAssigned = Boolean(selectedAgentId);
  const showHighlightedDate = isAssigned && assignedDate && assignedDate !== '—';

  return (
    <div className="min-w-0 space-y-1">
      <div className="relative">
        <select
          aria-label={`Assign sales agent for ${shopName}`}
          value={selectedAgentId}
          disabled={disabled || saving || loadingAgents}
          onClick={(event) => event.stopPropagation()}
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
    </div>
  );
};

export default DailyCallInlineAgentSelect;
