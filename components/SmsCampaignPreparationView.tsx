import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Contact } from '../types';
import { MessageSquare, Users, Gift, Clock, Star, Copy, Check, Send, TerminalSquare, Trash2 } from 'lucide-react';
import { useToast } from './ToastProvider';
import * as customerDatabaseService from '../services/customerDatabaseLocalApiService';
import { getVipStandingSummary } from '../utils/vipStanding';
import { queueSmsCampaign, getGatewayDevices, getSmsHistory } from '../services/smsService';
import { getMessageTemplates } from '../services/aiSalesAgentService';
import { AIMessageTemplate } from '../types';

interface Props {
  currentUser: UserProfile | null;
}

type CampaignType = 'birthday' | 'no_purchase' | 'vip_reengage' | 'prospective' | 'custom' | 'history' | 'logs';

interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

export const SmsCampaignPreparationView: React.FC<Props> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CampaignType>('birthday');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [queueing, setQueueing] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedSimId, setSelectedSimId] = useState<number | undefined>();
  const [customMessage, setCustomMessage] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState('');
  const [manualNumbers, setManualNumbers] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const addLog = (message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
    if (type === 'error') console.error(message);
    else if (type === 'warn') console.warn(message);
    else console.log(message);
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await getSmsHistory();
      if (data.history) {
        setSmsHistory(data.history);
      }
    } catch (e) {
      console.error('Failed to load SMS history', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    const loadCustomers = async () => {
      addLog('[SMS Blasting] Initializing component, loading gateway devices and customers...', 'info');
      try {
        setLoading(true);
        try {
          const deviceData = await getGatewayDevices();
          addLog(`[SMS Blasting] Gateway devices loaded: ${Object.keys(deviceData.devices || {}).length} devices found`, 'info');
          if (deviceData.devices) {
            setDevices(Object.values(deviceData.devices));
          }
        } catch (e) {
          addLog(`[SMS Blasting] Could not load gateway devices: ${e}`, 'warn');
        }
        const data = await customerDatabaseService.fetchContacts();
        addLog(`[SMS Blasting] Fetched ${data?.length || 0} customers from database`, 'success');
        setCustomers(data);

        try {
          const templatesData = await getMessageTemplates();
          const activeSmsTemplates = templatesData.filter((t: AIMessageTemplate) =>
            t.is_active && ['birthday', 'no_purchase', 'vip_reengage', 'prospective'].includes(t.template_type)
          );

          const templateMap: Record<string, string> = {};
          // Reverse loop so newer templates overwrite older ones if multiple exist for the same type
          for (let i = activeSmsTemplates.length - 1; i >= 0; i--) {
            templateMap[activeSmsTemplates[i].template_type] = activeSmsTemplates[i].content;
          }
          setSavedTemplates(templateMap);
          addLog(`[SMS Blasting] Loaded ${Object.keys(templateMap).length} active SMS templates`, 'info');
        } catch (e) {
          addLog(`[SMS Blasting] Failed to load custom templates, falling back to defaults: ${e}`, 'warn');
        }
      } catch (error) {
        addLog(`[SMS Blasting] Failed to load customers: ${error}`, 'error');
        addToast({ type: 'error', message: 'Failed to load customer database' });
      } finally {
        setLoading(false);
      }
    };
    loadCustomers();
  }, [addToast]);

  const currentMonth = new Date().getMonth() + 1; // 1-12



  const campaignData = useMemo(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const birthday = customers.filter(c => {
      const bday = c.contactPersons?.[0]?.birthday;
      if (!bday) return false;
      const [, month] = bday.split('-');
      return parseInt(month, 10) === currentMonth;
    });

    const noPurchase = customers.filter(c => {
      if (!c.lastContactDate || c.status !== 'Active') return false;
      return new Date(c.lastContactDate) < oneMonthAgo;
    });

    const vipReengage = customers.filter(c => {
      if (c.status !== 'Active') return false;
      const standing = getVipStandingSummary(c.priceGroup, c.totalSales || 0);
      return standing.tone === 'silver' || standing.tone === 'gold';
    });

    const prospective = customers.filter(c => c.status === 'Inquiry Only' || c.status === 'Inactive');

    return { birthday, noPurchase, vipReengage, prospective, custom: customers };
  }, [customers, currentMonth]);

  const getTemplate = (type: CampaignType, customer: Contact) => {
    if (type === 'custom') return customMessage;
    if (type === 'history' || type === 'logs') return '';

    const name = customer.contactPersons?.[0]?.name || customer.company;

    if (savedTemplates[type]) {
      return savedTemplates[type].replace(/{name}/g, name || 'Valued Customer');
    }

    switch (type) {
      case 'birthday':
        return `Happy Birthday ${name}! Wishing you a fantastic day from your friends at TND. As a special gift, enjoy a discount on your next purchase!`;
      case 'no_purchase':
        return `Hi ${name}, we miss you at TND! It's been a while since your last order. Check out our latest products and let us know if we can help you with anything.`;
      case 'vip_reengage':
        return `Hi ${name}, as one of our valued VIP clients, we want to ensure you're maximizing your benefits. Contact us today to see our exclusive VIP offers!`;
      case 'prospective':
        return `Hi ${name}, looking for top-quality products? TND is here to provide the best service and pricing. Let's discuss how we can support your business!`;
      default:
        return '';
    }
  };

  const handleCopy = (text: string, index: number) => {
    addLog(`[SMS Blasting] Copied template to clipboard (index ${index})`, 'info');
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    addToast({ type: 'success', message: 'Message copied to clipboard' });
  };

  const activeList = useMemo(() => {
    if (activeTab === 'custom') return (campaignData.custom || []).filter(c => selectedCustomerIds.has(c.id));
    if (activeTab === 'no_purchase') return campaignData.noPurchase || [];
    if (activeTab === 'vip_reengage') return campaignData.vipReengage || [];
    if (activeTab === 'birthday') return campaignData.birthday || [];
    if (activeTab === 'prospective') return campaignData.prospective || [];
    return [];
  }, [activeTab, campaignData, selectedCustomerIds]);

  const manualNumberList = useMemo(() => {
    if (activeTab !== 'custom' || !manualNumbers.trim()) return [];
    return manualNumbers
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }, [manualNumbers, activeTab]);

  const totalQueueCount = activeTab === 'custom'
    ? activeList.length + manualNumberList.length
    : activeList.length;

  const handleQueueAll = async () => {
    if (totalQueueCount === 0) return;

    addLog(`[SMS Blasting] Preparing to queue ${totalQueueCount} messages for campaign: ${activeTab}`, 'info');
    addLog(`[SMS Blasting] Selected SIM ID: ${selectedSimId ?? 'Default'}`, 'info');
    setQueueing(true);
    try {
      const messages = activeList
        .map(client => {
          const mobile = client.contactPersons?.[0]?.mobile || client.mobile;
          if (!mobile) return null;
          return {
            phone: mobile,
            message: activeTab === 'custom' ? customMessage : getTemplate(activeTab, client)
          };
        })
        .filter(Boolean) as Array<{ phone: string; message: string }>;

      if (activeTab === 'custom') {
        manualNumberList.forEach(phone => {
          messages.push({ phone, message: customMessage });
        });
        addLog(`[SMS Blasting] Appended ${manualNumberList.length} manual numbers to custom queue`, 'info');
      }

      if (messages.length === 0) {
        addLog('[SMS Blasting] Queue aborted: No valid mobile numbers found', 'warn');
        addToast({ type: 'error', message: 'No valid mobile numbers found in this list' });
        return;
      }

      if (activeTab === 'custom' && !customMessage.trim()) {
        addLog('[SMS Blasting] Queue aborted: Custom message is empty', 'warn');
        addToast({ type: 'error', message: 'Custom message cannot be empty' });
        setQueueing(false);
        return;
      }

      addLog(`[SMS Blasting] Dispatching ${messages.length} messages to backend API...`, 'info');
      await queueSmsCampaign(messages, selectedSimId);
      addLog(`[SMS Blasting] Successfully queued ${messages.length} messages`, 'success');
      addToast({ type: 'success', message: `Successfully queued ${messages.length} messages for background sending` });
    } catch (error) {
      addLog(`[SMS Blasting] Queue error: ${error}`, 'error');
      addToast({ type: 'error', message: 'Failed to queue messages' });
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div className="min-h-full overflow-auto bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-5">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#294a68] via-[#315574] to-[#1675bd] text-white shadow-lg shadow-slate-200/70">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight md:text-2xl">SMS Blasting</h1>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-200/20">
                    Customer Outreach
                  </span>
                </div>
                <p className="max-w-2xl text-sm text-blue-100">Prepare targeted customer messages, review every recipient, and queue SMS for background delivery.</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <select
                aria-label="Select SIM"
                className="min-w-[170px] rounded-xl border border-white/20 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-white focus:ring-2 focus:ring-white/40"
                value={selectedSimId ?? ''}
                onChange={(e) => setSelectedSimId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Default SIM</option>
                {devices.length > 0 && devices[0].sim_cards?.map((sim: any) => (
                  <option key={sim.subscriptionId} value={sim.subscriptionId}>
                    SIM {sim.slotIndex + 1} — {sim.carrierName}
                  </option>
                ))}
              </select>
              <button
                onClick={handleQueueAll}
                disabled={queueing || totalQueueCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
              >
                <Send className="h-4 w-4" />
                {queueing ? 'Queueing...' : `Queue ${totalQueueCount} Messages`}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 px-5 py-3.5 md:px-6">
              <Users className="h-4 w-4 text-blue-200" />
              <div><p className="text-[11px] uppercase tracking-wide text-blue-200">Customers loaded</p><p className="text-lg font-bold">{customers.length.toLocaleString()}</p></div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5 md:px-6">
              <Send className="h-4 w-4 text-emerald-200" />
              <div><p className="text-[11px] uppercase tracking-wide text-blue-200">Ready to queue</p><p className="text-lg font-bold">{totalQueueCount.toLocaleString()}</p></div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5 md:px-6">
              <span className={`h-2.5 w-2.5 rounded-full ${devices.length > 0 ? 'bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.15)]' : 'bg-amber-300'}`} />
              <div><p className="text-[11px] uppercase tracking-wide text-blue-200">Gateway status</p><p className="text-lg font-bold">{devices.length > 0 ? 'Connected' : 'Waiting'}</p></div>
            </div>
          </div>
        </section>

        <nav className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm shadow-slate-200/60" aria-label="SMS campaign views">
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            <button onClick={() => { addLog('[SMS Blasting] Switched tab to: history', 'info'); setActiveTab('history'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'history' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Clock className="h-4 w-4" /> Activity History
            </button>
            <button onClick={() => { addLog('[SMS Blasting] Switched tab to: birthday', 'info'); setActiveTab('birthday'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'birthday' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Gift className="h-4 w-4" /> Birthdays <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{campaignData?.birthday?.length || 0}</span>
            </button>
            <button onClick={() => { addLog('[SMS Blasting] Switched tab to: no_purchase', 'info'); setActiveTab('no_purchase'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'no_purchase' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Clock className="h-4 w-4" /> No Purchase &gt; 1 Month <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{campaignData?.noPurchase?.length || 0}</span>
            </button>
            <button onClick={() => { addLog('[SMS Blasting] Switched tab to: vip_reengage', 'info'); setActiveTab('vip_reengage'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'vip_reengage' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Star className="h-4 w-4" /> VIP Re-engagement <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{campaignData?.vipReengage?.length || 0}</span>
            </button>
            <button onClick={() => { addLog('[SMS Blasting] Switched tab to: prospective', 'info'); setActiveTab('prospective'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'prospective' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Users className="h-4 w-4" /> Prospective <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{campaignData?.prospective?.length || 0}</span>
            </button>
            {currentUser && (String(currentUser.user_type) === '1' || currentUser.role === 'Master User' || currentUser.role === 'Company Owner' || currentUser.role === 'developer' || currentUser.role === 'main') ? (
              <button onClick={() => { addLog('[SMS Blasting] Switched tab to: custom', 'info'); setActiveTab('custom'); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'custom' ? 'bg-blue-50 text-[#1675bd] shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <MessageSquare className="h-4 w-4" /> Custom Message
              </button>
            ) : null}
            <button onClick={() => setActiveTab('logs')} className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <TerminalSquare className="h-4 w-4" /> Logs
            </button>
          </div>
        </nav>

        <main className="min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
          {activeTab === 'logs' ? (
            <div className="flex h-full min-h-[420px] flex-col bg-slate-950 text-slate-300 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                <div><p className="font-semibold text-slate-100">System Logs</p><p className="mt-0.5 text-[11px] text-slate-500">Technical events from the current session</p></div>
                <div className="flex gap-2">
                  <button onClick={() => { const text = logs.map(l => `[${l.timestamp.toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n'); navigator.clipboard.writeText(text); addToast({ type: 'success', message: 'Logs copied to clipboard' }); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-slate-200 transition hover:bg-slate-700"><Copy className="h-3.5 w-3.5" /> Copy All</button>
                  <button onClick={() => setLogs([])} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-slate-200 transition hover:bg-rose-600 hover:text-white"><Trash2 className="h-3.5 w-3.5" /> Clear</button>
                </div>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-4">
                {logs.length === 0 ? <div className="italic text-slate-600">No logs recorded yet.</div> : logs.map((log, i) => <div key={i} className="flex gap-3 rounded px-2 py-1 hover:bg-white/[0.03]"><span className="shrink-0 text-slate-600">[{log.timestamp.toLocaleTimeString()}]</span><span className={`flex-1 ${log.type === 'error' ? 'text-rose-400' : log.type === 'warn' ? 'text-amber-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>{log.message}</span></div>)}
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="flex h-full min-h-[420px] flex-col">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold text-slate-800">Recent SMS Activity</h3><p className="mt-0.5 text-xs text-slate-500">Review queued, sent, and failed messages.</p></div>
                <button onClick={loadHistory} disabled={loadingHistory} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">{loadingHistory ? 'Refreshing...' : 'Refresh'}</button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Message</th><th className="px-5 py-3">SIM</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {smsHistory.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">{loadingHistory ? 'Loading history...' : 'No SMS activity found.'}</td></tr> : smsHistory.map((row) => <tr key={row.id} className="transition hover:bg-blue-50/30"><td className="whitespace-nowrap px-5 py-3 align-top text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td><td className="px-5 py-3 align-top font-semibold text-[#315574]">{row.phone}</td><td className="max-w-xs truncate px-5 py-3 align-top text-slate-700" title={row.message}>{row.message}</td><td className="px-5 py-3 align-top text-slate-600">{row.sim_id ? `SIM ${row.sim_id}` : 'Default'}</td><td className="px-5 py-3 align-top"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${row.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : row.status === 'failed' ? 'bg-rose-100 text-rose-700' : row.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{row.status.toUpperCase()}</span></td><td className="px-5 py-3 align-top text-xs text-slate-500">{row.details || '-'}{row.retries > 0 && <span className="ml-1 text-rose-500">(Retries: {row.retries})</span>}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'custom' ? (
            <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr]">
              <div className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-slate-800">Select Customers</h3><p className="mt-1 text-xs text-slate-500">Choose saved customers or add numbers below.</p></div><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{selectedCustomerIds.size} selected</span></div>
                <div className="relative mb-3"><input type="text" placeholder="Search customers..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /></div>
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3"><label className="mb-1.5 block text-xs font-semibold text-blue-800">Manual recipients</label><input type="text" placeholder="09171234567, 09181234567" className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={manualNumbers} onChange={e => { setManualNumbers(e.target.value); addLog(`[SMS Blasting] Manual numbers updated: ${e.target.value}`, 'info'); }} /><p className="mt-1.5 text-[11px] text-blue-700">Separate multiple numbers with commas.</p></div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">{(campaignData.custom || []).filter(c => !customerSearch || c.company?.toLowerCase().includes(customerSearch.toLowerCase()) || c.contactPersons?.[0]?.name?.toLowerCase().includes(customerSearch.toLowerCase())).map(c => { const mobile = c.contactPersons?.[0]?.mobile || c.mobile; return <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 transition last:border-0 hover:bg-blue-50/50"><input type="checkbox" checked={selectedCustomerIds.has(c.id)} onChange={(e) => { const next = new Set(selectedCustomerIds); if (e.target.checked) { next.add(c.id); addLog(`[SMS Blasting] Selected customer: ${c.company} (ID: ${c.id})`, 'info'); } else { next.delete(c.id); addLog(`[SMS Blasting] Deselected customer: ${c.company} (ID: ${c.id})`, 'info'); } setSelectedCustomerIds(next); }} className="h-4 w-4 rounded border-slate-300 text-[#1675bd] focus:ring-[#1675bd]" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800">{c.company}</div><div className="truncate text-xs text-slate-500">{mobile || 'No mobile'}</div></div></label>; })}</div>
              </div>
              <div className="flex flex-col p-5 md:p-7"><div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-800">Compose Custom Message</h3><p className="mt-1 text-xs text-slate-500">Write the message that will be sent to every selected recipient.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customMessage.length > 160 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{customMessage.length} characters</span></div><textarea className="min-h-[260px] w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Write your custom SMS message here..." value={customMessage} onChange={e => setCustomMessage(e.target.value)} /><div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500"><span>Use clear, concise wording for best delivery.</span><span className="font-semibold text-slate-700">{totalQueueCount} recipient{totalQueueCount === 1 ? '' : 's'}</span></div></div>
            </div>
          ) : loading ? (
            <div className="flex min-h-[420px] items-center justify-center"><div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading clients...</div></div>
          ) : activeList.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-5 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Users className="h-6 w-6" /></div><h3 className="font-semibold text-slate-800">No clients match this campaign</h3><p className="mt-1 max-w-md text-sm text-slate-500">Try another campaign tab or review the customer records used for this audience.</p></div>
          ) : (
            <div className="h-full overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50/95 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"><tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Mobile</th><th className="px-5 py-3">Generated Template</th><th className="w-28 px-5 py-3 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{activeList.map((client, index) => { const mobile = client.contactPersons?.[0]?.mobile || client.mobile || 'No Mobile'; const template = getTemplate(activeTab, client); return <tr key={client.id} className="transition hover:bg-blue-50/30"><td className="px-5 py-4 align-top"><div className="font-semibold text-[#315574]">{client.company}</div><div className="mt-0.5 text-xs text-slate-500">{client.contactPersons?.[0]?.name || 'No contact name'}</div></td><td className="px-5 py-4 align-top text-slate-600">{mobile}</td><td className="px-5 py-4 align-top"><div className="max-w-3xl rounded-xl border border-slate-100 bg-slate-50 p-3 leading-5 text-slate-700">{template}</div></td><td className="px-5 py-4 align-top text-center"><button onClick={() => handleCopy(template, index)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1675bd] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#125d98] active:scale-[0.98]" title="Copy Template">{copiedIndex === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedIndex === index ? 'Copied' : 'Copy'}</button></td></tr>; })}</tbody></table></div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SmsCampaignPreparationView;
