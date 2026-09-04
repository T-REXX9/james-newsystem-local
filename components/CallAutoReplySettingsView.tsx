import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquareText, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { AIMessageTemplate, UserProfile } from '../types';
import * as aiSalesAgentService from '../services/aiSalesAgentService';
import {
  AutoReplyAuditEntry,
  AutoReplySettings,
  fetchAutoReplyAudit,
  fetchAutoReplySettings,
  saveAutoReplySettings,
} from '../services/callingSystemService';
import { useToast } from './ToastProvider';

interface CallAutoReplySettingsViewProps {
  currentUser: UserProfile | null;
}

const isMasterUser = (user: UserProfile | null) => {
  const role = String(user?.role || '').trim().toLowerCase();
  return String(user?.user_type || '') === '1' || ['owner', 'company owner', 'master user', 'main'].includes(role);
};

const displayDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const CallAutoReplySettingsView: React.FC<CallAutoReplySettingsViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<AIMessageTemplate[]>([]);
  const [settings, setSettings] = useState<AutoReplySettings | null>(null);
  const [audit, setAudit] = useState<AutoReplyAuditEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState('60');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isMasterUser(currentUser)) return;
    setLoading(true);
    try {
      const [nextSettings, nextAudit, nextTemplates] = await Promise.all([
        fetchAutoReplySettings(),
        fetchAutoReplyAudit(),
        aiSalesAgentService.getMessageTemplates(),
      ]);
      const activeTemplates = nextTemplates.filter((template) => template.is_active);
      setSettings(nextSettings);
      setAudit(nextAudit);
      setTemplates(activeTemplates);
      setIsActive(Number(nextSettings?.lis_active || 0) === 1 || nextSettings?.lis_active === true);
      setTemplateId(nextSettings?.ltemplate_id ? String(nextSettings.ltemplate_id) : activeTemplates[0]?.id || '');
      setCooldownMinutes(String(nextSettings?.lcooldown_minutes || 60));
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load missed-call reply settings.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, currentUser]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isMasterUser(currentUser)) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Master User access required</h1>
          <p className="mt-2 text-sm text-slate-600">Only the Master User can configure missed-call automatic replies and review their audit history.</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const parsedCooldown = Number(cooldownMinutes);
    if (!templateId) {
      addToast({ type: 'warning', message: 'Select an active SMS template before saving.' });
      return;
    }
    if (!Number.isInteger(parsedCooldown) || parsedCooldown < 1 || parsedCooldown > 10080) {
      addToast({ type: 'warning', message: 'Cooldown must be a whole number between 1 and 10080 minutes.' });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveAutoReplySettings({ isActive, templateId, cooldownMinutes: parsedCooldown });
      setSettings(saved);
      addToast({ type: 'success', message: isActive ? 'Missed-call automatic replies enabled.' : 'Missed-call automatic replies disabled.' });
      await load();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save missed-call reply settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Communications / Calling</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white"><MessageSquareText className="h-7 w-7 text-blue-700" /> Missed-Call Replies</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Configure one controlled SMS reply for missed or rejected inbound calls. Replies are sent through the existing James SMS gateway and are protected by a per-staff, per-number cooldown.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </button>
        </header>

        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div><h2 className="font-bold text-blue-900 dark:text-blue-100">Transparent accountability control</h2><p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">The phone app reports call metadata only. No call recording is used. This setting does not send a message when the feature is disabled, a template is unavailable, or the cooldown has not expired.</p></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Automatic reply rule</h2><p className="mt-1 text-sm text-slate-500">Master User controls the global rule for all authenticated staff phones.</p></div>
            <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600" /> Enable automatic replies</label>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Active SMS template
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} disabled={loading || saving || templates.length === 0} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950">
                <option value="">{templates.length === 0 ? 'No active templates available' : 'Select a template'}</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Cooldown (minutes)
              <input type="number" min="1" max="10080" step="1" value={cooldownMinutes} onChange={(event) => setCooldownMinutes(event.target.value)} disabled={loading || saving} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950" />
            </label>
          </div>
          {templateId && templates.find((template) => template.id === templateId) && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">Preview: {templates.find((template) => template.id === templateId)?.content}</div>}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs text-slate-500">Last saved: {displayDate(settings?.lupdated_at)}</span>
            <button type="button" onClick={() => void handleSave()} disabled={saving || loading || templates.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save rule'}</button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Reply audit history</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Caller</th><th className="px-3 py-2">Message sent</th></tr></thead><tbody>{audit.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No automatic replies have been queued.</td></tr> : audit.map((entry) => <tr key={String(entry.lid)} className="border-b border-slate-100 dark:border-slate-800/70"><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{displayDate(entry.lsent_at)}</td><td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-100">{`${entry.agent_first_name || ''} ${entry.agent_last_name || ''}`.trim() || `Staff #${entry.lagent_id}`}</td><td className="px-3 py-3">{entry.lphone_number}</td><td className="max-w-lg px-3 py-3 text-slate-600 dark:text-slate-300">{entry.lmessage_sent}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
};

export default CallAutoReplySettingsView;
