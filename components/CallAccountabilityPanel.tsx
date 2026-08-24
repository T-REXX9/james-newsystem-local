import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Phone, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  CallDeviceHealth,
  fetchCallDeviceHealth,
  fetchHardwareCallLogs,
  HardwareCallLog,
} from '../services/callingSystemService';

interface CallAccountabilityPanelProps {
  title?: string;
  compact?: boolean;
  agentId?: string | number;
  limit?: number;
}

const formatAgentName = (device: CallDeviceHealth) => {
  const name = `${device.agent_first_name || ''} ${device.agent_last_name || ''}`.trim();
  return name || `Staff #${device.lagent_id}`;
};

const formatDirection = (direction: string) => {
  if (direction === 'missed') return 'Missed incoming';
  if (direction === 'inbound') return 'Incoming';
  if (direction === 'outbound') return 'Outgoing';
  return direction || 'Unknown';
};

const formatDuration = (seconds: number | string) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const statusLabel = (status?: string) => {
  switch (status) {
    case 'background_active': return 'Background active';
    case 'app_open': return 'App open';
    case 'permission_missing': return 'Permission missing';
    case 'no_network': return 'No network';
    case 'device_offline': return 'Phone offline';
    default: return status || 'Unknown';
  }
};

const CallAccountabilityPanel: React.FC<CallAccountabilityPanelProps> = ({
  title = 'Calling accountability',
  compact = false,
  agentId,
  limit = 8,
}) => {
  const [devices, setDevices] = useState<CallDeviceHealth[]>([]);
  const [logs, setLogs] = useState<HardwareCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => !compact);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [nextDevices, nextLogs] = await Promise.all([
        fetchCallDeviceHealth(),
        fetchHardwareCallLogs({ agentId }),
      ]);
      setDevices(nextDevices);
      setLogs(nextLogs.slice(0, limit));
    } catch (error) {
      toast.error('Unable to load calling accountability', {
        description: error instanceof Error ? error.message : 'Check the API connection and staff session.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId, limit]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const activeCount = useMemo(
    () => devices.filter((device) => ['background_active', 'app_open'].includes(device.effective_status || device.lstatus || '')).length,
    [devices],
  );

  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${compact ? 'p-3' : 'p-5'}`}>
      <div className={`${compact && isExpanded ? 'mb-2' : !compact && isExpanded ? 'mb-4' : ''} flex flex-wrap items-start justify-between gap-3`}>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-80 focus:outline-none"
          >
            <Activity className="h-5 w-5 text-brand-blue" />
            <h2 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-slate-900 dark:text-white`}>{title}</h2>
            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
          {!compact && isExpanded && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Visible device health and call metadata. Audio is never recorded.</p>}
        </div>
        {isExpanded && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Loading calling data…</div>
      ) : (
        <>
          <div className={`${compact ? 'mb-3 flex flex-wrap items-center gap-3' : 'mb-4 grid gap-3 sm:grid-cols-2'}`}>
            <div className={`rounded-lg bg-blue-50 dark:bg-blue-950/30 ${compact ? 'flex items-center gap-2 px-3 py-1.5' : 'p-3'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300`}>Registered phones</div>
              <div className={`${compact ? 'text-sm' : 'mt-1 text-2xl'} font-bold text-blue-900 dark:text-blue-100`}>{devices.length}</div>
            </div>
            <div className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 ${compact ? 'flex items-center gap-2 px-3 py-1.5' : 'p-3'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300`}>Currently reporting</div>
              <div className={`${compact ? 'text-sm' : 'mt-1 text-2xl'} font-bold text-emerald-900 dark:text-emerald-100`}>{activeCount}</div>
            </div>
          </div>

          {devices.length > 0 && (
            <div className={`${compact ? 'mb-3 flex flex-wrap gap-2' : 'mb-5 grid gap-2 md:grid-cols-2'}`}>
              {devices.map((device) => {
                const status = device.effective_status || device.lstatus || 'unknown';
                const active = ['background_active', 'app_open'].includes(status);
                return (
                  <div key={`${device.lid}-${device.ldevice_id}`} className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 ${compact ? 'px-3 py-1.5 w-auto' : 'p-3'}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Smartphone className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex items-baseline gap-2">
                        <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{formatAgentName(device)}</div>
                        {!compact && <div className="truncate text-[11px] text-slate-500">Last signal: {formatDateTime(device.llast_seen)}</div>}
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                      {active ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {statusLabel(status)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr>
                  <th className={`px-2 ${compact ? 'py-1' : 'py-2'}`}>Date</th>
                  <th className={`px-2 ${compact ? 'py-1' : 'py-2'}`}>Staff</th>
                  <th className={`px-2 ${compact ? 'py-1' : 'py-2'}`}>Customer number</th>
                  <th className={`px-2 ${compact ? 'py-1' : 'py-2'}`}>Direction</th>
                  <th className={`px-2 ${compact ? 'py-1' : 'py-2'}`}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className={`px-2 ${compact ? 'py-3' : 'py-5'} text-center text-slate-500`}>No hardware call logs available.</td></tr>
                ) : logs.map((log) => (
                  <tr key={String(log.lid)} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className={`px-2 ${compact ? 'py-1.5' : 'py-2'} text-slate-600 dark:text-slate-300`}>{formatDateTime(log.lcall_timestamp)}</td>
                    <td className={`px-2 ${compact ? 'py-1.5' : 'py-2'} font-medium text-slate-800 dark:text-slate-100`}>{`${log.agent_first_name || ''} ${log.agent_last_name || ''}`.trim() || `Staff #${log.lagent_id}`}</td>
                    <td className={`px-2 ${compact ? 'py-1.5' : 'py-2'}`}><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{log.lphone_number}</span></td>
                    <td className={`px-2 ${compact ? 'py-1.5' : 'py-2'}`}>{formatDirection(log.ldirection)}</td>
                    <td className={`px-2 ${compact ? 'py-1.5' : 'py-2'}`}>{formatDuration(log.lduration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}
    </section>
  );
};

export default CallAccountabilityPanel;
