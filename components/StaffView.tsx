
import React, { useState, useMemo } from 'react';
import {
  Search, Filter, MoreHorizontal, Mail, Phone, MapPin,
  BarChart2, TrendingUp, Users, Calendar, Briefcase,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle, Award
} from 'lucide-react';
import { Contact } from '../types';
import { MOCK_AGENTS } from '../constants';
import { fetchContacts } from '../services/supabaseService';
import CompanyName from './CompanyName';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useRealtimeList } from '../hooks/useRealtimeList';

const ACTIVITY_DATA = [
  { name: 'Mon', calls: 12, meetings: 4, emails: 25 },
  { name: 'Tue', calls: 18, meetings: 3, emails: 30 },
  { name: 'Wed', calls: 15, meetings: 6, emails: 22 },
  { name: 'Thu', calls: 22, meetings: 2, emails: 40 },
  { name: 'Fri', calls: 25, meetings: 5, emails: 35 },
];

const StaffView: React.FC = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(MOCK_AGENTS[0].id);
  const [activeTab, setActiveTab] = useState<'clients' | 'calls' | 'performance'>('clients');

  // Use real-time list hook for contacts
  const { data: allContacts, isLoading } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
  });

  const selectedAgent = MOCK_AGENTS.find(a => a.id === selectedAgentId) || MOCK_AGENTS[0];

  // Filter data for the selected agent (memoized)
  const assignedClients = useMemo(() => {
    return allContacts.filter(c => c.assignedAgent === selectedAgent.name);
  }, [allContacts, selectedAgent.name]);

  // Aggregate Call History from assigned clients (memoized)
  const callHistory = useMemo(() => {
    return assignedClients.flatMap(c =>
      c.interactions
        .filter(i => i.type === 'Call' || i.type === 'Meeting')
        .map(i => ({
          ...i,
          clientName: c.name,
          clientCompany: c.company,
          clientPastName: c.pastName,
          clientId: c.id
        }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [assignedClients]);

  // Calculate Actual Sales for this agent (memoized)
  const totalSalesValue = useMemo(() => {
    return assignedClients.reduce((acc, client) => {
      const clientTotal = client.salesHistory.reduce((sum, sale) => sum + sale.amount, 0);
      return acc + clientTotal;
    }, 0);
  }, [assignedClients]);

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950 animate-fadeIn overflow-hidden">
      
      {/* LEFT: Agent List Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-blue" />
                Staff & Agents
            </h2>
            <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Find agent..." 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-brand-blue transition-colors text-slate-700 dark:text-slate-200 placeholder-slate-400"
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {MOCK_AGENTS.map(agent => (
                <div 
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedAgentId === agent.id 
                        ? 'bg-brand-blue/5 dark:bg-brand-blue/20 border-brand-blue/30 dark:border-brand-blue/30' 
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="relative">
                             <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover" />
                             <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-bold truncate ${selectedAgentId === agent.id ? 'text-brand-blue dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {agent.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.role}</p>
                        </div>
                        {selectedAgentId === agent.id && <div className="w-1 h-8 bg-brand-blue rounded-full"></div>}
                    </div>
                </div>
            ))}
        </div>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-brand-blue transition-colors">
                + Add New Agent
            </button>
        </div>
      </div>

      {/* RIGHT: Agent Dashboard */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Agent Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shadow-sm z-10">
              <div className="flex justify-between items-start">
                  <div className="flex items-start gap-5">
                      <img src={selectedAgent.avatar} alt={selectedAgent.name} className="w-16 h-16 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700" />
                      <div>
                          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedAgent.name}</h1>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1"><Award className="w-4 h-4 text-amber-500" /> {selectedAgent.role}</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> email@tnd-opc.ph</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> +63 917 ...</span>
                          </div>
                      </div>
                  </div>
                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      Edit Profile
                  </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4 mt-8">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase">Total Sales (Month)</p>
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">₱{(selectedAgent.salesThisMonth / 1000).toFixed(0)}k</h3>
                      <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> +12% vs target
                      </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase">Conversion Rate</p>
                          <BarChart2 className="w-4 h-4 text-brand-blue" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedAgent.conversionRate}%</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Avg industry: 25%
                      </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase">Active Clients</p>
                          <Users className="w-4 h-4 text-indigo-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedAgent.activeClients}</h3>
                      <p className="text-[10px] text-indigo-600 font-medium mt-1 flex items-center gap-1">
                         Assigned count
                      </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase">Calls (Week)</p>
                          <Phone className="w-4 h-4 text-amber-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedAgent.callsThisWeek}</h3>
                      <p className="text-[10px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> High activity
                      </p>
                  </div>
              </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0">
              <div className="flex gap-6">
                  <button 
                    onClick={() => setActiveTab('clients')}
                    className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'clients' 
                        ? 'border-brand-blue text-brand-blue' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                      Assigned Clients ({assignedClients.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('calls')}
                    className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'calls' 
                        ? 'border-brand-blue text-brand-blue' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                      Call History
                  </button>
                  <button 
                    onClick={() => setActiveTab('performance')}
                    className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'performance' 
                        ? 'border-brand-blue text-brand-blue' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                      Performance Metrics
                  </button>
              </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
              
              {/* --- CLIENTS TAB --- */}
              {activeTab === 'clients' && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                                  <th className="p-4 font-semibold">Client Name</th>
                                  <th className="p-4 font-semibold">Company</th>
                                  <th className="p-4 font-semibold">Status</th>
                                  <th className="p-4 font-semibold">Total Purchases</th>
                                  <th className="p-4 font-semibold">Last Contact</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {assignedClients.length === 0 ? (
                                  <tr>
                                      <td colSpan={5} className="p-8 text-center text-slate-500 italic">No clients assigned yet.</td>
                                  </tr>
                              ) : assignedClients.map(client => {
                                  const clientTotalSales = client.salesHistory.reduce((sum, s) => sum + s.amount, 0);
                                  const hasPurchased = clientTotalSales > 0;

                                  return (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={client.avatar} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" alt="" />
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{client.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                            <CompanyName 
                                              name={client.company}
                                              pastName={client.pastName}
                                              entity={client}
                                              className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400"
                                              formerNameClassName="text-xs text-slate-400 dark:text-slate-500 font-medium"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                client.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900' : 
                                                'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                            }`}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {hasPurchased ? (
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                                    <CheckCircle className="w-4 h-4" />
                                                    ₱{clientTotalSales.toLocaleString()}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{client.lastContactDate}</td>
                                    </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* --- CALL HISTORY TAB --- */}
              {activeTab === 'calls' && (
                  <div className="max-w-3xl mx-auto space-y-6">
                      {callHistory.length === 0 ? (
                          <div className="text-center p-12 text-slate-400">No call history found.</div>
                      ) : callHistory.map((call, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-4 shadow-sm">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                  call.type === 'Meeting' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                  {call.type === 'Meeting' ? <Calendar className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                              </div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                                              {call.type} with {call.clientName}
                                          </h4>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">
                                              <CompanyName 
                                                name={call.clientCompany}
                                                pastName={call.clientPastName}
                                                entity={call}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400"
                                                formerNameClassName="text-[10px] text-slate-400 dark:text-slate-500 font-medium"
                                              />
                                          </p>
                                      </div>
                                      <span className="text-xs font-mono text-slate-400">{call.date}</span>
                                  </div>
                                  <div className="mt-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                      "{call.notes}"
                                  </div>
                                  {call.sentiment && (
                                      <div className="mt-2 flex items-center gap-2">
                                          <span className="text-xs text-slate-400">Sentiment:</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                              call.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 
                                              call.sentiment === 'Negative' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-slate-100 text-slate-600'
                                          }`}>
                                              {call.sentiment}
                                          </span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {/* --- PERFORMANCE TAB --- */}
              {activeTab === 'performance' && (
                  <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Weekly Activity Breakdown</h3>
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={ACTIVITY_DATA}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '8px', border:'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                      <Bar dataKey="calls" name="Calls" fill="#3b82f6" stackId="a" radius={[0, 0, 4, 4]} />
                                      <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" stackId="a" radius={[0, 0, 0, 0]} />
                                      <Bar dataKey="emails" name="Emails" fill="#cbd5e1" stackId="a" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-white shadow-lg mb-4">
                              <span className="text-3xl font-bold">92</span>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Performance Score</h3>
                          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
                              Excellent work! Ranked #2 among all sales agents this month.
                          </p>
                      </div>
                  </div>
              )}

          </div>
      </div>
    </div>
  );
};

export default StaffView;
