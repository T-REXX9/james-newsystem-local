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
    <div className="flex h-full flex-col bg-[#f5f7fa] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#315574]">SMS Blast: Send SMS to Customers</h1>
          <p className="text-sm text-slate-500">Generate targeted client lists and queue messages for the TND SMS Gateway.</p>
        </div>
        <div className="flex items-center gap-4">
          {devices.length > 0 && devices[0].sim_cards && devices[0].sim_cards.length > 0 && (
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={selectedSimId ?? ''}
              onChange={(e) => setSelectedSimId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Default SIM</option>
              {devices[0].sim_cards.map((sim: any) => (
                <option key={sim.subscriptionId} value={sim.subscriptionId}>
                  SIM {sim.slotIndex + 1} — {sim.carrierName}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleQueueAll}
            disabled={queueing || totalQueueCount === 0}
            className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {queueing ? 'Queueing...' : `Queue ${totalQueueCount} Messages`}
          </button>
        </div>
      </div>

      <div className="mb-4 flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => { addLog('[SMS Blasting] Switched tab to: history', 'info'); setActiveTab('history'); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'history' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="h-4 w-4" /> Activity History
        </button>
        <button
          onClick={() => { addLog('[SMS Blasting] Switched tab to: birthday', 'info'); setActiveTab('birthday'); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'birthday' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Gift className="h-4 w-4" /> Birthdays ({campaignData?.birthday?.length || 0})
        </button>
        <button
          onClick={() => { addLog('[SMS Blasting] Switched tab to: no_purchase', 'info'); setActiveTab('no_purchase'); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'no_purchase' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="h-4 w-4" /> No Purchase &gt; 1 Month ({campaignData?.noPurchase?.length || 0})
        </button>
        <button
          onClick={() => { addLog('[SMS Blasting] Switched tab to: vip_reengage', 'info'); setActiveTab('vip_reengage'); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'vip_reengage' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Star className="h-4 w-4" /> VIP Re-engagement ({campaignData?.vipReengage?.length || 0})
        </button>
        <button
          onClick={() => { addLog('[SMS Blasting] Switched tab to: prospective', 'info'); setActiveTab('prospective'); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'prospective' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="h-4 w-4" /> Prospective ({campaignData?.prospective?.length || 0})
        </button>
        {currentUser && (String(currentUser.user_type) === '1' || currentUser.role === 'Master User' || currentUser.role === 'Company Owner' || currentUser.role === 'developer' || currentUser.role === 'main') ? (
          <button
            onClick={() => { addLog('[SMS Blasting] Switched tab to: custom', 'info'); setActiveTab('custom'); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'custom' ? 'border-[#1675bd] text-[#1675bd]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <MessageSquare className="h-4 w-4" /> Custom Message
          </button>
        ) : null}
        <div className="flex-1" />
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === 'logs' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <TerminalSquare className="h-4 w-4" /> Logs
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {activeTab === 'logs' ? (
          <div className="flex h-full flex-col bg-slate-900 text-slate-300 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 p-2 bg-slate-800">
              <span className="font-semibold text-slate-200">System Logs</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = logs.map(l => `[${l.timestamp.toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
                    navigator.clipboard.writeText(text);
                    addToast({ type: 'success', message: 'Logs copied to clipboard' });
                  }}
                  className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 text-slate-200"
                >
                  <Copy className="h-3 w-3" /> Copy All
                </button>
                <button
                  onClick={() => setLogs([])}
                  className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 hover:bg-rose-600 hover:text-white text-slate-200"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">No logs recorded yet.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-500 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
                    <span className={`flex-1 ${
                      log.type === 'error' ? 'text-rose-400' :
                      log.type === 'warn' ? 'text-amber-400' :
                      log.type === 'success' ? 'text-emerald-400' :
                      'text-slate-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800">Recent SMS Activity</h3>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="rounded bg-white px-3 py-1 text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingHistory ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 font-medium text-slate-700 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">SIM</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smsHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        {loadingHistory ? 'Loading history...' : 'No SMS activity found.'}
                      </td>
                    </tr>
                  ) : (
                    smsHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 align-top font-medium text-[#315574]">
                          {row.phone}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700 max-w-xs truncate" title={row.message}>
                          {row.message}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-600">
                          {row.sim_id ? `SIM ${row.sim_id}` : 'Default'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.status === 'sent' ? 'bg-green-100 text-green-800' :
                            row.status === 'failed' ? 'bg-red-100 text-red-800' :
                            row.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {row.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-slate-500">
                          {row.details || '-'}
                          {row.retries > 0 && <span className="ml-1 text-red-500">(Retries: {row.retries})</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'custom' ? (
          <div className="flex h-full">
            <div className="w-1/3 border-r border-slate-200 bg-slate-50 p-4 flex flex-col">
              <h3 className="font-semibold text-slate-800 mb-2">Select Customers</h3>
              <input
                type="text"
                placeholder="Search customers..."
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-2"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Or enter manual numbers (comma-separated):</label>
                <input
                  type="text"
                  placeholder="e.g., 09171234567, 09181234567"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={manualNumbers}
                  onChange={e => {
                    setManualNumbers(e.target.value);
                    addLog(`[SMS Blasting] Manual numbers updated: ${e.target.value}`, 'info');
                  }}
                />
              </div>
              <div className="flex-1 overflow-y-auto border border-slate-200 bg-white rounded">
                {(campaignData.custom || [])
                  .filter(c => !customerSearch || c.company?.toLowerCase().includes(customerSearch.toLowerCase()) || c.contactPersons?.[0]?.name?.toLowerCase().includes(customerSearch.toLowerCase()))
                  .map(c => {
                    const mobile = c.contactPersons?.[0]?.mobile || c.mobile;
                    return (
                      <label key={c.id} className="flex items-center gap-3 p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selectedCustomerIds);
                            if (e.target.checked) {
                              next.add(c.id);
                              addLog(`[SMS Blasting] Selected customer: ${c.company} (ID: ${c.id})`, 'info');
                            } else {
                              next.delete(c.id);
                              addLog(`[SMS Blasting] Deselected customer: ${c.company} (ID: ${c.id})`, 'info');
                            }
                            setSelectedCustomerIds(next);
                          }}
                          className="rounded border-slate-300 text-[#1675bd] focus:ring-[#1675bd]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">{c.company}</div>
                          <div className="truncate text-xs text-slate-500">{mobile || 'No mobile'}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
            <div className="w-2/3 p-6 flex flex-col">
              <h3 className="font-semibold text-slate-800 mb-4">Compose Custom Message</h3>
              <textarea
                className="w-full flex-1 rounded border border-slate-300 p-4 text-sm resize-none focus:border-[#1675bd] focus:ring-1 focus:ring-[#1675bd]"
                placeholder="Write your custom SMS message here..."
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
              />
              <div className="mt-2 text-right text-xs text-slate-500">
                {customMessage.length} characters
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">Loading clients...</div>
        ) : activeList.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-slate-500">No clients match this campaign criteria.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 font-medium text-slate-700 shadow-sm">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Generated Template</th>
                <th className="w-24 px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeList.map((client, index) => {
                const mobile = client.contactPersons?.[0]?.mobile || client.mobile || 'No Mobile';
                const template = getTemplate(activeTab, client);
                return (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-[#315574]">{client.company}</div>
                      <div className="text-xs text-slate-500">{client.contactPersons?.[0]?.name}</div>
                    </td>
                    <td className="px-4 py-3 align-top">{mobile}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="rounded bg-slate-100 p-2 text-slate-700">{template}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                      <button
                        onClick={() => handleCopy(template, index)}
                        className="inline-flex items-center gap-1 rounded bg-[#1675bd] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#125d98]"
                        title="Copy Template"
                      >
                        {copiedIndex === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedIndex === index ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SmsCampaignPreparationView;
