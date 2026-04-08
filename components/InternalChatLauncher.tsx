import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  MessageSquare,
  Minus,
  Search,
  Send,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  buildDirectConversationKey,
  fetchInternalChatConversations,
  fetchInternalChatMessages,
  fetchInternalChatParticipants,
  fetchInternalChatUnreadCount,
  InternalChatConversationSummary,
  InternalChatMessage,
  InternalChatParticipant,
  markInternalChatConversationRead,
  sendInternalChatMessage,
} from '../services/internalChatLocalApiService';
import {
  InternalChatRealtimeEvent,
  openInternalChatRealtimeStream,
} from '../services/internalChatRealtimeService';
import { useToast } from './ToastProvider';

interface InternalChatLauncherProps {
  user: UserProfile | null;
}

interface MentionContext {
  start: number;
  end: number;
  query: string;
}

const INTERNAL_CHAT_REALTIME_ENABLED = true;

const formatRelativeTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const diffMs = Date.now() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString();
};

const participantLabel = (participant: InternalChatParticipant) =>
  participant.full_name?.trim() || participant.email?.trim() || `User ${participant.id}`;

const avatarFallback = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).map((token) => token[0]?.toUpperCase() || '').join('') || 'U';
};

const compareMessages = (left: InternalChatMessage, right: InternalChatMessage) => {
  const leftTime = Date.parse(left.created_at || '');
  const rightTime = Date.parse(right.created_at || '');
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return Number(left.id || 0) - Number(right.id || 0);
};

const mergeConversationMessages = (
  previous: Record<string, InternalChatMessage[]>,
  incoming: InternalChatMessage[]
): Record<string, InternalChatMessage[]> => {
  if (incoming.length === 0) {
    return previous;
  }

  const nextState = { ...previous };

  incoming.forEach((message) => {
    const key = message.conversation_key;
    const existing = nextState[key] || [];
    if (existing.some((item) => item.id === message.id)) {
      return;
    }

    nextState[key] = [...existing, message].sort(compareMessages);
  });

  return nextState;
};

const getMentionContext = (value: string, cursorPosition: number): MentionContext | null => {
  const safeCursor = Math.max(0, Math.min(cursorPosition, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const atIndex = beforeCursor.lastIndexOf('@');

  if (atIndex < 0) return null;

  const prefix = atIndex === 0 ? ' ' : beforeCursor[atIndex - 1];
  if (!/\s/.test(prefix)) return null;

  const query = beforeCursor.slice(atIndex + 1);
  if (/\s/.test(query)) return null;

  return {
    start: atIndex,
    end: safeCursor,
    query,
  };
};

const InternalChatLauncher: React.FC<InternalChatLauncherProps> = ({ user }) => {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [participants, setParticipants] = useState<InternalChatParticipant[]>([]);
  const [conversations, setConversations] = useState<InternalChatConversationSummary[]>([]);
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, InternalChatMessage[]>>({});
  const [draft, setDraft] = useState('');
  const [mentionSelections, setMentionSelections] = useState<Record<string, string>>({});
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedConversationKeyRef = useRef<string | null>(null);
  const latestShellRequestRef = useRef(0);
  const hasLoadedShellDataRef = useRef(false);
  const isOpenRef = useRef(false);
  const isMinimizedRef = useRef(false);
  const lastRealtimeErrorToastAtRef = useRef(0);
  const shellAbortControllerRef = useRef<AbortController | null>(null);
  const messageAbortControllerRef = useRef<AbortController | null>(null);
  const [isPageActive, setIsPageActive] = useState(() => (
    typeof document !== 'undefined' ? document.visibilityState === 'visible' && document.hasFocus() : true
  ));

  const refreshUnreadCount = async (silent = true) => {
    if (!user) return;
    try {
      const nextCount = await fetchInternalChatUnreadCount();
      setUnreadCount(nextCount);
    } catch (error) {
      if (!silent) {
        addToast({
          type: 'error',
          title: 'Unable to load chat badge',
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      }
    }
  };

  const loadShellData = async (options?: { forceSelection?: boolean; background?: boolean }) => {
    if (!user) return;
    const forceSelection = options?.forceSelection ?? false;
    const background = options?.background ?? false;
    const requestId = ++latestShellRequestRef.current;
    const shouldShowLoading = !background && !hasLoadedShellDataRef.current;

    if (shouldShowLoading) {
      setIsLoading(true);
    }

    try {
      shellAbortControllerRef.current?.abort();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      shellAbortControllerRef.current = controller;
      const [participantRows, conversationRows, nextUnreadCount] = await Promise.all([
        fetchInternalChatParticipants({ signal: controller?.signal }),
        fetchInternalChatConversations({ signal: controller?.signal }),
        fetchInternalChatUnreadCount({ signal: controller?.signal }),
      ]);

      if (requestId !== latestShellRequestRef.current) {
        return;
      }

      setParticipants(participantRows);
      setConversations(conversationRows);
      setUnreadCount(nextUnreadCount);
      hasLoadedShellDataRef.current = true;

      const preferredSelection = forceSelection ? null : selectedConversationKey;
      if (!preferredSelection) {
        const unreadConversation = conversationRows.find((item) => item.unread_count > 0);
        const newestConversation = conversationRows[0];
        const firstParticipant = participantRows[0];
        const nextSelection =
          unreadConversation?.conversation_key ||
          newestConversation?.conversation_key ||
          (firstParticipant ? buildDirectConversationKey(user.id, firstParticipant.id) : null);

        setSelectedConversationKey(nextSelection);
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        return;
      }
      addToast({
        type: 'error',
        title: 'Unable to load internal chat',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      if (requestId === latestShellRequestRef.current && shouldShowLoading) {
        setIsLoading(false);
      }
    }
  };

  const refreshConversationMessages = async (conversationKey: string, markRead = false) => {
    if (!user || !conversationKey) return;

    try {
      messageAbortControllerRef.current?.abort();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      messageAbortControllerRef.current = controller;
      const items = await fetchInternalChatMessages(conversationKey, { signal: controller?.signal });
      setMessagesByConversation((prev) => ({ ...prev, [conversationKey]: items }));

      if (markRead) {
        await markInternalChatConversationRead(conversationKey);
        await refreshUnreadCount();
        const nextConversations = await fetchInternalChatConversations();
        setConversations(nextConversations);
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        return;
      }
      addToast({
        type: 'error',
        title: 'Unable to load chat messages',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  useEffect(() => {
    selectedConversationKeyRef.current = selectedConversationKey;
  }, [selectedConversationKey]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const syncPageActivity = () => {
      setIsPageActive(document.visibilityState === 'visible' && document.hasFocus());
    };

    syncPageActivity();
    window.addEventListener('focus', syncPageActivity);
    window.addEventListener('blur', syncPageActivity);
    document.addEventListener('visibilitychange', syncPageActivity);

    return () => {
      window.removeEventListener('focus', syncPageActivity);
      window.removeEventListener('blur', syncPageActivity);
      document.removeEventListener('visibilitychange', syncPageActivity);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      hasLoadedShellDataRef.current = false;
      shellAbortControllerRef.current?.abort();
      messageAbortControllerRef.current?.abort();
      setParticipants([]);
      setConversations([]);
      setSelectedConversationKey(null);
      setMessagesByConversation({});
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();
  }, [user]);

  useEffect(() => {
    if (!INTERNAL_CHAT_REALTIME_ENABLED || !user || !isPageActive) return;

    return openInternalChatRealtimeStream(
      (event: InternalChatRealtimeEvent) => {
        const currentConversationKey = selectedConversationKeyRef.current;
        const launcherOpen = isOpenRef.current;
        const launcherMinimized = isMinimizedRef.current;

        if (event.type === 'conversation.read') {
          void loadShellData({ background: true });
          return;
        }

        const incomingMessage: InternalChatMessage = {
          ...event.message,
          is_from_current_user: event.message.sender_id === user.id,
        };

        setMessagesByConversation((prev) => mergeConversationMessages(prev, [incomingMessage]));
        void loadShellData({ background: true });

        if (launcherOpen && currentConversationKey === incomingMessage.conversation_key) {
          void refreshConversationMessages(
            currentConversationKey,
            !launcherMinimized && incomingMessage.sender_id !== user.id
          );
          return;
        }

        if (incomingMessage.sender_id !== user.id) {
          addToast({
            type: 'info',
            title: incomingMessage.sender_name ? `New message from ${incomingMessage.sender_name}` : 'New internal message',
            description: incomingMessage.message || 'Open chat to view the message.',
          });
        }
      },
      () => {
        const now = Date.now();
        if (isOpenRef.current && now - lastRealtimeErrorToastAtRef.current >= 10000) {
          lastRealtimeErrorToastAtRef.current = now;
          addToast({
            type: 'warning',
            title: 'Live chat disconnected',
            description: 'Trying to reconnect to internal chat.',
          });
        }
      }
    );
  }, [addToast, isPageActive, user]);

  useEffect(() => {
    if (!user || !isOpen || isMinimized) return;

    void loadShellData({
      background: hasLoadedShellDataRef.current,
    });
  }, [user, isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen || isMinimized || !selectedConversationKey) return;
    refreshConversationMessages(selectedConversationKey, true);
  }, [isOpen, isMinimized, selectedConversationKey]);

  useEffect(() => {
    if (!messageViewportRef.current || !selectedConversationKey) return;
    const viewport = messageViewportRef.current;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messagesByConversation, selectedConversationKey]);

  useEffect(() => () => {
    shellAbortControllerRef.current?.abort();
    messageAbortControllerRef.current?.abort();
  }, []);

  const participantMap = useMemo(() => {
    const map = new Map<string, InternalChatParticipant>();
    participants.forEach((participant) => map.set(participant.id, participant));
    conversations.forEach((conversation) => {
      map.set(conversation.other_participant.id, conversation.other_participant);
    });
    return map;
  }, [participants, conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.conversation_key === selectedConversationKey) || null,
    [conversations, selectedConversationKey]
  );

  const selectedOtherParticipant = useMemo(() => {
    if (!user || !selectedConversationKey) return null;
    if (selectedConversation) return selectedConversation.other_participant;

    const ids = selectedConversationKey.split(':').slice(1);
    const otherId = ids.find((id) => id !== user.id);
    return otherId ? participantMap.get(otherId) || null : null;
  }, [participantMap, selectedConversation, selectedConversationKey, user]);

  const filteredParticipants = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const enriched = participants.map((participant) => {
      const conversationKey = user ? buildDirectConversationKey(user.id, participant.id) : '';
      const summary = conversations.find((item) => item.conversation_key === conversationKey) || null;
      return {
        participant,
        conversationKey,
        summary,
      };
    });

    const matches = enriched.filter(({ participant }) => {
      if (!needle) return true;
      return (
        participantLabel(participant).toLowerCase().includes(needle) ||
        participant.email.toLowerCase().includes(needle) ||
        participant.role.toLowerCase().includes(needle)
      );
    });

    return matches.sort((left, right) => {
      const leftUnread = left.summary?.unread_count || 0;
      const rightUnread = right.summary?.unread_count || 0;
      if (leftUnread !== rightUnread) return rightUnread - leftUnread;

      const leftTimestamp = left.summary?.last_message_at ? Date.parse(left.summary.last_message_at) : 0;
      const rightTimestamp = right.summary?.last_message_at ? Date.parse(right.summary.last_message_at) : 0;
      if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;

      return participantLabel(left.participant).localeCompare(participantLabel(right.participant));
    });
  }, [conversations, participants, searchQuery, user]);

  const selectedMessages = selectedConversationKey ? messagesByConversation[selectedConversationKey] || [] : [];

  const mentionSuggestions = useMemo(() => {
    if (!mentionContext) return [];
    const needle = mentionContext.query.trim().toLowerCase();

    return participants
      .filter((participant) => {
        if (!needle) return true;
        return (
          participantLabel(participant).toLowerCase().includes(needle) ||
          participant.email.toLowerCase().includes(needle) ||
          participant.role.toLowerCase().includes(needle)
        );
      })
      .slice(0, 8);
  }, [mentionContext, participants]);

  const toggleLauncher = () => {
    if (!user) return;

    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
      return;
    }

    if (isMinimized) {
      setIsMinimized(false);
      return;
    }

    setIsOpen(false);
  };

  const handleSelectConversation = async (conversationKey: string) => {
    setSelectedConversationKey(conversationKey);
    setIsOpen(true);
    setIsMinimized(false);
    await refreshConversationMessages(conversationKey, true);
  };

  const handleDraftChange = (value: string, cursorPosition: number) => {
    setDraft(value);
    setMentionContext(getMentionContext(value, cursorPosition));
  };

  const insertMention = (participant: InternalChatParticipant) => {
    if (!textareaRef.current || !mentionContext) return;
    const token = `@${participantLabel(participant)}`;
    const nextValue =
      `${draft.slice(0, mentionContext.start)}${token} ${draft.slice(mentionContext.end)}`;

    setDraft(nextValue);
    setMentionSelections((prev) => ({
      ...prev,
      [participant.id]: token,
    }));
    setMentionContext(null);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextCursor = mentionContext.start + token.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSend = async () => {
    if (!user || isSending) return;
    const trimmedMessage = draft.trim();
    if (!trimmedMessage) return;

    const selectedRecipientId = selectedOtherParticipant?.id;
    const mentionedRecipientIds = Object.entries(mentionSelections)
      .filter(([, token]) => trimmedMessage.includes(token))
      .map(([participantId]) => participantId);

    const recipientIds = Array.from(
      new Set([selectedRecipientId, ...mentionedRecipientIds].filter((value): value is string => Boolean(value)))
    );

    if (recipientIds.length === 0) {
      addToast({
        type: 'warning',
        title: 'Choose a recipient',
        description: 'Select a conversation or mention at least one account before sending.',
      });
      return;
    }

    setIsSending(true);
    try {
      const created = await sendInternalChatMessage({
        message: trimmedMessage,
        conversationKey: selectedConversationKey || undefined,
        recipientIds,
      });

      if (created.length > 0) {
        setMessagesByConversation((prev) => mergeConversationMessages(prev, created));
      }

      setDraft('');
      setMentionSelections({});
      setMentionContext(null);

      await loadShellData({ background: true });

      if (!selectedConversationKey && created[0]?.conversation_key) {
        setSelectedConversationKey(created[0].conversation_key);
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to send message',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return null;
  }

  const launcherButton = (
    <button
      onClick={toggleLauncher}
      className={`relative rounded-full p-2 transition-colors ${
        isOpen && !isMinimized
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
      title="Open Internal Chat"
      aria-label="Open Internal Chat"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  const modal = isOpen && !isMinimized && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed bottom-4 right-4 z-[1200] flex h-[min(680px,78vh)] w-[min(960px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 max-md:inset-x-2 max-md:bottom-2 max-md:top-20 max-md:h-auto max-md:w-auto max-md:flex-col"
          role="dialog"
          aria-modal="false"
          aria-label="Internal chat"
        >
          <aside className="flex w-[280px] flex-col border-r border-slate-200 bg-slate-50/80 max-md:h-[220px] max-md:w-full max-md:border-b max-md:border-r-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Internal Chat</h2>
                <p className="text-xs text-slate-500">Direct messages across active accounts</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Minimize chat"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search accounts..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Loading conversations...</div>
              ) : filteredParticipants.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No active accounts found.</div>
              ) : (
                filteredParticipants.map(({ participant, conversationKey, summary }) => {
                  const isSelected = selectedConversationKey === conversationKey;
                  const preview = summary?.last_message_preview || `Start a chat with ${participantLabel(participant)}`;

                  return (
                    <button
                      key={participant.id}
                      onClick={() => handleSelectConversation(conversationKey)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${
                        isSelected ? 'bg-brand-blue/10' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue">
                        {participant.avatar_url ? (
                          <img src={participant.avatar_url} alt={participantLabel(participant)} className="h-full w-full object-cover" />
                        ) : (
                          avatarFallback(participantLabel(participant))
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{participantLabel(participant)}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {summary?.last_message_at ? formatRelativeTime(summary.last_message_at) : ''}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500">{participant.role}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-500">{preview}</p>
                          {(summary?.unread_count || 0) > 0 && (
                            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                              {summary?.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white max-md:min-h-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-blue/10 text-sm font-semibold text-brand-blue">
                  {selectedOtherParticipant?.avatar_url ? (
                    <img
                      src={selectedOtherParticipant.avatar_url}
                      alt={selectedOtherParticipant ? participantLabel(selectedOtherParticipant) : 'Conversation'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    avatarFallback(selectedOtherParticipant ? participantLabel(selectedOtherParticipant) : 'Chat')
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedOtherParticipant ? participantLabel(selectedOtherParticipant) : 'Select a conversation'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {selectedOtherParticipant ? `${selectedOtherParticipant.role}${selectedOtherParticipant.email ? ` • ${selectedOtherParticipant.email}` : ''}` : 'Choose an account from the list'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMinimized(true)}
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Collapse chat"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div ref={messageViewportRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-5 py-4">
              {!selectedConversationKey ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  Select an account to start chatting.
                </div>
              ) : selectedMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  {selectedOtherParticipant ? `No messages yet with ${participantLabel(selectedOtherParticipant)}.` : 'No messages yet.'}
                </div>
              ) : (
                selectedMessages.map((message) => {
                  const isMine = message.is_from_current_user;
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'bg-brand-blue text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                        <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
                          <span className="font-semibold">{isMine ? 'You' : message.sender_name}</span>
                          <span>{formatRelativeTime(message.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => handleDraftChange(event.target.value, event.target.selectionStart || event.target.value.length)}
                  onClick={(event) => handleDraftChange(draft, (event.target as HTMLTextAreaElement).selectionStart || draft.length)}
                  onKeyUp={(event) => handleDraftChange(draft, (event.currentTarget as HTMLTextAreaElement).selectionStart || draft.length)}
                  onKeyDown={(event) => {
                    if (mentionSuggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                      event.preventDefault();
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={3}
                  placeholder={selectedOtherParticipant ? `Message ${participantLabel(selectedOtherParticipant)}. Use @name to include other accounts.` : 'Select an account or type @name to mention recipients.'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />

                {mentionContext && mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-[calc(100%+8px)] left-0 z-10 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Mention Account
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {mentionSuggestions.map((participant) => (
                        <button
                          key={participant.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            insertMention(participant);
                          }}
                          className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue">
                            {participant.avatar_url ? (
                              <img src={participant.avatar_url} alt={participantLabel(participant)} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              avatarFallback(participantLabel(participant))
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{participantLabel(participant)}</p>
                            <p className="truncate text-xs text-slate-500">
                              {participant.role}{participant.email ? ` • ${participant.email}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => void handleSend()}
                  disabled={isSending || draft.trim() === ''}
                  className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>,
        document.body
      )
    : null;

  const minimizedBar = isOpen && isMinimized && typeof document !== 'undefined'
    ? createPortal(
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-[1200] flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-900/20 transition hover:bg-slate-50"
        >
          <div className="relative">
            <MessageSquare className="h-4 w-4 text-brand-blue" />
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-slate-800">Internal Chat</span>
        </button>,
        document.body
      )
    : null;

  return (
    <>
      {launcherButton}
      {modal}
      {minimizedBar}
    </>
  );
};

export default InternalChatLauncher;
