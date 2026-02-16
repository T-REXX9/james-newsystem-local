import React, { useMemo } from 'react';
import { Clock, MessageSquare, Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { CallLogEntry, Contact, Inquiry } from '../types';

interface AgentCallActivityProps {
  callLogs: CallLogEntry[];
  inquiries: Inquiry[];
  contacts: Contact[];
  maxItems?: number;
  title?: string;
  className?: string;
  onItemClick?: (item: AgentActivityItem) => void;
}

export type AgentActivityItem = (CallLogEntry & { type: 'call' }) | (Inquiry & { type: 'inquiry' });

const formatRelativeTime = (value?: string | null) => {
  if (!value) return '';
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

const getOutcomeClasses = (outcome?: string) => {
  switch (outcome) {
    case 'positive':
      return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300';
    case 'follow_up':
      return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300';
    case 'negative':
      return 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  }
};

const getSentimentClasses = (sentiment?: string) => {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300';
    case 'negative':
      return 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300';
    case 'neutral':
      return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  }
};

const AgentCallActivity: React.FC<AgentCallActivityProps> = ({
  callLogs,
  inquiries,
  contacts,
  maxItems = 8,
  title = 'Recent Activity',
  className = '',
  onItemClick
}) => {
  const contactsMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((contact) => map.set(contact.id, contact));
    return map;
  }, [contacts]);

  const recentActivity = useMemo(() => {
    const merged: AgentActivityItem[] = [
      ...callLogs.map((log) => ({ ...log, type: 'call' as const })),
      ...inquiries.map((inquiry) => ({ ...inquiry, type: 'inquiry' as const }))
    ];

    return merged
      .sort((a, b) => Date.parse(b.occurred_at || '') - Date.parse(a.occurred_at || ''))
      .slice(0, maxItems);
  }, [callLogs, inquiries, maxItems]);

  const getContactName = (contactId: string) => contactsMap.get(contactId)?.company || 'Unknown contact';

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-brand-blue" />
          <h2 className="text-base font-bold text-slate-800 dark:text-white">{title}</h2>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">Latest {recentActivity.length} updates</span>
      </div>

      {recentActivity.length === 0 ? (
        <div className="text-center p-10 text-slate-400 dark:text-slate-500">No recent activity</div>
      ) : (
        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {recentActivity.map((item) => {
            const isCall = item.type === 'call';
            const directionColor =
              isCall && item.direction === 'inbound'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300';

            const Wrapper: React.ElementType = typeof onItemClick === 'function' ? 'button' : 'div';
            const wrapperProps = typeof onItemClick === 'function'
              ? {
                type: 'button',
                onClick: () => onItemClick(item),
                className: 'w-full text-left p-2.5 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700 hover:border-brand-blue/40 hover:bg-white dark:hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue/40'
              }
              : {
                className: 'p-2.5 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700'
              };

            return (
              <Wrapper
                key={`${item.type}-${item.id}`}
                {...wrapperProps}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center">
                    {isCall ? (
                      item.direction === 'inbound' ? (
                        <PhoneIncoming className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <PhoneOutgoing className="w-5 h-5 text-brand-blue" />
                      )
                    ) : (
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {getContactName(item.contact_id)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {isCall
                            ? `${item.channel.toUpperCase()} • ${item.agent_name}`
                            : `Inquiry via ${item.channel}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.occurred_at)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {isCall ? item.notes || 'Call logged' : item.notes || item.title}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isCall ? (
                        <>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${directionColor}`}>
                            {item.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {item.channel === 'text' ? 'Text' : 'Voice'}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getOutcomeClasses(item.outcome)}`}>
                            {item.outcome === 'follow_up'
                              ? 'Follow-up'
                              : item.outcome
                                ? item.outcome.replace('_', ' ')
                                : 'Logged'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            Inquiry
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getSentimentClasses(item.sentiment)}`}>
                            {item.sentiment ? item.sentiment : 'New'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentCallActivity;
