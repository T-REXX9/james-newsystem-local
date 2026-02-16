import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Mail, MessageSquare, Phone, Users } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import MetricsCard from './MetricsCard';
import TasksView from './TasksView';
import AgentCallActivity from './AgentCallActivity';
import { fetchCallLogs, fetchContacts, fetchInquiries, fetchTeamMessages } from '../services/supabaseService';
import { supabase } from '../lib/supabaseClient';
import { CallLogEntry, Contact, Inquiry, Task, TeamMessage, UserProfile } from '../types';

interface SalesAgentDashboardProps {
  currentUser: UserProfile | null;
}

const SalesAgentDashboard: React.FC<SalesAgentDashboardProps> = ({ currentUser }) => {
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [agentTaskStats, setAgentTaskStats] = useState<{ total: number; completed: number }>({
    total: 0,
    completed: 0
  });

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const agentName = currentUser?.full_name || '';

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.full_name) {
        setTeamMessages([]);
        setCallLogs([]);
        setInquiries([]);
        setContacts([]);
        setAgentTaskStats({ total: 0, completed: 0 });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [messagesData, callLogsData, inquiriesData, contactsData] = await Promise.all([
          fetchTeamMessages(),
          fetchCallLogs(),
          fetchInquiries(),
          fetchContacts()
        ]);

        const agentContacts = contactsData.filter((contact) => contact.salesman === agentName);
        const agentContactIds = new Set(agentContacts.map((contact) => contact.id));

        setContacts(agentContacts);
        setTeamMessages(messagesData.filter((message) => message.is_from_owner));
        setCallLogs(callLogsData.filter((log) => log.agent_name === agentName));
        setInquiries(inquiriesData.filter((inquiry) => agentContactIds.has(inquiry.contact_id)));
      } catch (err) {
        console.error('Error loading sales agent dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agentName, currentUser?.full_name]);

  useEffect(() => {
    const channel = supabase
      .channel('team-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload: any) => {
        const newMessage = payload?.new as TeamMessage | undefined;
        if (newMessage?.is_from_owner) {
          setTeamMessages((prev) =>
            [...prev, newMessage].sort(
              (a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || '')
            )
          );
        }
      });

    channel.subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      } else if ((channel as any)?.unsubscribe) {
        (channel as any).unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [teamMessages]);

  const handleTasksLoaded = useCallback((agentTasks: Task[]) => {
    setAgentTaskStats({
      total: agentTasks.length,
      completed: agentTasks.filter((task) => task.status === 'Done').length
    });
  }, []);

  const tasksCompleted = useMemo(() => agentTaskStats.completed, [agentTaskStats.completed]);
  const callsMade = useMemo(() => callLogs.length, [callLogs]);
  const messagesReceived = useMemo(() => teamMessages.length, [teamMessages]);
  const activeCustomers = useMemo(
    () => contacts.filter((contact) => contact.status === 'Active').length,
    [contacts]
  );

  const mockTrends = {
    tasks: 8,
    calls: 5,
    messages: 3,
    customers: 6
  };

  const formatRelativeTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const diffMs = Date.now() - parsed.getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  if (!currentUser?.full_name) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
          <div className="flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-brand-blue" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Sales agent dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Please sign in with a valid profile to view your tasks and activity.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 gap-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Tasks Completed"
          value={tasksCompleted.toString()}
          trend={mockTrends.tasks}
          icon={CheckCircle}
          trendLabel="vs last week"
        />
        <MetricsCard
          title="Calls Made"
          value={callsMade.toString()}
          trend={mockTrends.calls}
          icon={Phone}
          trendLabel="vs last week"
        />
        <MetricsCard
          title="Messages from Owner"
          value={messagesReceived.toString()}
          trend={mockTrends.messages}
          icon={MessageSquare}
          trendLabel="vs last week"
        />
        <MetricsCard
          title="Active Customers"
          value={activeCustomers.toString()}
          trend={mockTrends.customers}
          icon={Users}
          trendLabel="vs last week"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <TasksView
            currentUser={currentUser}
            variant="embedded"
            maxVisibleTasks={5}
            onTasksLoaded={handleTasksLoaded}
          />

          <AgentCallActivity callLogs={callLogs} inquiries={inquiries} contacts={contacts} />
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-brand-blue" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Inbox</h2>
            </div>
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center bg-slate-50 dark:bg-slate-900/50">
              <Mail className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">Inbox feature coming soon</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                You&apos;ll be able to view and manage customer emails here
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-brand-blue" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Messages from Owner</h2>
            </div>

            {teamMessages.length === 0 ? (
              <div className="text-center p-10 text-slate-400 dark:text-slate-500">
                No messages from owner
              </div>
            ) : (
              <div
                ref={chatContainerRef}
                className="max-h-[420px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
              >
                {teamMessages.map((message, index) => {
                  const isRightAligned = index % 2 === 0;
                  return (
                    <div key={message.id} className={`flex ${isRightAligned ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`flex max-w-[80%] gap-3 ${
                          isRightAligned ? 'flex-row-reverse text-right' : 'flex-row'
                        }`}
                      >
                        <img
                          src={message.sender_avatar || 'https://i.pravatar.cc/100?img=12'}
                          alt={message.sender_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div
                          className={`p-3 rounded-lg shadow-sm ${
                            isRightAligned
                              ? 'bg-brand-blue text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold">{message.sender_name}</span>
                            <span className="text-xs opacity-80">
                              {formatRelativeTime(message.created_at)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{message.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesAgentDashboard;
