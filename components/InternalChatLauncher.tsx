import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  CornerUpLeft,
  MessageSquare,
  Minus,
  Search,
  Send,
  SmilePlus,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  buildDirectConversationKey,
  fetchInternalChatConversations,
  fetchInternalChatMessages,
  fetchInternalChatParticipants,
  fetchInternalChatTypingState,
  fetchInternalChatUnreadCount,
  InternalChatConversationSummary,
  InternalChatMessage,
  InternalChatParticipant,
  markInternalChatConversationRead,
  sendInternalChatMessage,
  toggleInternalChatReaction,
  updateInternalChatTyping,
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

interface ComposerReplyTarget {
  message_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  is_from_current_user: boolean;
}

const INTERNAL_CHAT_REALTIME_ENABLED = true;
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '👀'] as const;
const TYPING_IDLE_MS = 3000;
const TYPING_KEEPALIVE_MS = 2500;
const MESSAGE_HIGHLIGHT_MS = 1800;

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

const truncateReplyText = (value: string, maxLength = 120) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const replySenderLabel = (replyPreview: Pick<ComposerReplyTarget, 'sender_name' | 'is_from_current_user'>) =>
  replyPreview.is_from_current_user ? 'You' : replyPreview.sender_name?.trim() || 'Unknown User';

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
    const existingIndex = existing.findIndex((item) => item.id === message.id);
    if (existingIndex >= 0) {
      nextState[key] = existing
        .map((item, index) => (index === existingIndex ? { ...item, ...message } : item))
        .sort(compareMessages);
      return;
    }

    nextState[key] = [...existing, message].sort(compareMessages);
  });

  return nextState;
};

const updateConversationMessage = (
  previous: Record<string, InternalChatMessage[]>,
  conversationKey: string,
  messageId: string,
  updater: (message: InternalChatMessage) => InternalChatMessage
): Record<string, InternalChatMessage[]> => {
  const existing = previous[conversationKey] || [];
  const nextMessages = existing.map((message) => (message.id === messageId ? updater(message) : message));
  return {
    ...previous,
    [conversationKey]: nextMessages.sort(compareMessages),
  };
};

const removeConversationMessages = (
  previous: Record<string, InternalChatMessage[]>,
  messageIds: string[]
): Record<string, InternalChatMessage[]> => {
  if (messageIds.length === 0) {
    return previous;
  }

  const ids = new Set(messageIds);
  return Object.fromEntries(
    Object.entries(previous).map(([conversationKey, messages]) => [
      conversationKey,
      messages.filter((message) => !ids.has(message.id)),
    ])
  );
};

const sortReactionSummaries = (reactions: InternalChatMessage['reactions']): InternalChatMessage['reactions'] =>
  [...reactions].sort((left, right) => {
    if ((left.count || 0) !== (right.count || 0)) {
      return (right.count || 0) - (left.count || 0);
    }

    return left.emoji.localeCompare(right.emoji);
  });

const toggleReactionState = (message: InternalChatMessage, emoji: string): Pick<InternalChatMessage, 'reactions' | 'current_user_reaction'> => {
  const previousReaction = message.current_user_reaction || null;
  const nextReaction = previousReaction === emoji ? null : emoji;
  const reactionMap = new Map(
    (message.reactions || []).map((reaction) => [
      reaction.emoji,
      { ...reaction },
    ])
  );

  if (previousReaction) {
    const existing = reactionMap.get(previousReaction);
    if (existing) {
      existing.count = Math.max(0, existing.count - 1);
      existing.reacted_by_current_user = false;
      if (existing.count === 0) {
        reactionMap.delete(previousReaction);
      } else {
        reactionMap.set(previousReaction, existing);
      }
    }
  }

  if (nextReaction) {
    const existing = reactionMap.get(nextReaction) || {
      emoji: nextReaction,
      count: 0,
      reacted_by_current_user: false,
    };
    existing.count += 1;
    existing.reacted_by_current_user = true;
    reactionMap.set(nextReaction, existing);
  }

  return {
    reactions: sortReactionSummaries(Array.from(reactionMap.values())),
    current_user_reaction: nextReaction,
  };
};

const formatDeliveryStatus = (message: InternalChatMessage): string => {
  if (message.is_pending) return 'Sending...';
  if (message.delivery_status === 'read') return 'Seen';
  if (message.delivery_status === 'delivered') return 'Delivered';
  return 'Sent';
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
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState('');
  const [mentionSelections, setMentionSelections] = useState<Record<string, string>>({});
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [openMessageActionId, setOpenMessageActionId] = useState<string | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [reactionPendingIds, setReactionPendingIds] = useState<Record<string, boolean>>({});
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const messageBottomRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messageActionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedConversationKeyRef = useRef<string | null>(null);
  const latestShellRequestRef = useRef(0);
  const hasLoadedShellDataRef = useRef(false);
  const isOpenRef = useRef(false);
  const isMinimizedRef = useRef(false);
  const lastRealtimeErrorToastAtRef = useRef(0);
  const shellAbortControllerRef = useRef<AbortController | null>(null);
  const messageAbortControllerRef = useRef<AbortController | null>(null);
  const typingStartTimeoutRef = useRef<number | null>(null);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const typingKeepAliveTimeoutRef = useRef<number | null>(null);
  const activeTypingConversationKeyRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const clearTypingTimers = () => {
    if (typingStartTimeoutRef.current !== null) {
      window.clearTimeout(typingStartTimeoutRef.current);
      typingStartTimeoutRef.current = null;
    }
    if (typingStopTimeoutRef.current !== null) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    if (typingKeepAliveTimeoutRef.current !== null) {
      window.clearTimeout(typingKeepAliveTimeoutRef.current);
      typingKeepAliveTimeoutRef.current = null;
    }
  };

  const pushTypingState = async (conversationKey: string, isTyping: boolean) => {
    if (!user || !conversationKey) return;

    try {
      const payload = await updateInternalChatTyping(conversationKey, isTyping);
      setTypingByConversation((prev) => ({
        ...prev,
        [conversationKey]: payload.typing_user_ids,
      }));
    } catch {
      // Typing is best-effort and should not interrupt chat usage.
    }
  };

  const stopTyping = (conversationKey = activeTypingConversationKeyRef.current) => {
    clearTypingTimers();

    const targetConversationKey = conversationKey || activeTypingConversationKeyRef.current;
    activeTypingConversationKeyRef.current = null;
    if (!targetConversationKey) return;

    void pushTypingState(targetConversationKey, false);
  };

  const scheduleTypingKeepAlive = (conversationKey: string) => {
    if (!conversationKey) return;

    if (typingKeepAliveTimeoutRef.current !== null) {
      window.clearTimeout(typingKeepAliveTimeoutRef.current);
    }

    typingKeepAliveTimeoutRef.current = window.setTimeout(() => {
      if (activeTypingConversationKeyRef.current !== conversationKey) {
        return;
      }

      void pushTypingState(conversationKey, true);
      scheduleTypingKeepAlive(conversationKey);
    }, TYPING_KEEPALIVE_MS);
  };

  const scheduleTypingUpdate = (nextDraft: string, conversationKey: string | null) => {
    if (!conversationKey || !selectedOtherParticipant) {
      stopTyping();
      return;
    }

    if (nextDraft.trim() === '') {
      stopTyping(conversationKey);
      return;
    }

    const wasTypingInConversation = activeTypingConversationKeyRef.current === conversationKey;
    if (!wasTypingInConversation) {
      if (
        activeTypingConversationKeyRef.current &&
        activeTypingConversationKeyRef.current !== conversationKey
      ) {
        stopTyping(activeTypingConversationKeyRef.current);
      }

      clearTypingTimers();
      activeTypingConversationKeyRef.current = conversationKey;
      void pushTypingState(conversationKey, true);
    } else {
      if (typingStartTimeoutRef.current !== null) {
        window.clearTimeout(typingStartTimeoutRef.current);
        typingStartTimeoutRef.current = null;
      }
      if (typingKeepAliveTimeoutRef.current !== null) {
        window.clearTimeout(typingKeepAliveTimeoutRef.current);
        typingKeepAliveTimeoutRef.current = null;
      }
      if (typingStopTimeoutRef.current !== null) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
    }

    scheduleTypingKeepAlive(conversationKey);
    typingStopTimeoutRef.current = window.setTimeout(() => {
      stopTyping(conversationKey);
    }, TYPING_IDLE_MS);
  };

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

      const preferredSelection = forceSelection ? null : selectedConversationKeyRef.current;
      const hasPreferredSelection = preferredSelection
        ? conversationRows.some((item) => item.conversation_key === preferredSelection) ||
          participantRows.some((participant) => buildDirectConversationKey(user.id, participant.id) === preferredSelection)
        : false;

      if (!hasPreferredSelection) {
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
      const [itemsResult, typingResult] = await Promise.allSettled([
        fetchInternalChatMessages(conversationKey, { signal: controller?.signal }),
        fetchInternalChatTypingState(conversationKey, { signal: controller?.signal }),
      ]);

      if (itemsResult.status === 'rejected') {
        throw itemsResult.reason;
      }

      const items = itemsResult.value;
      setMessagesByConversation((prev) => ({ ...prev, [conversationKey]: items }));
      if (typingResult.status === 'fulfilled') {
        setTypingByConversation((prev) => ({
          ...prev,
          [conversationKey]: typingResult.value.typing_user_ids,
        }));
      }

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
    if (!user) {
      hasLoadedShellDataRef.current = false;
      shellAbortControllerRef.current?.abort();
      messageAbortControllerRef.current?.abort();
      stopTyping();
      setParticipants([]);
      setConversations([]);
      setSelectedConversationKey(null);
      setMessagesByConversation({});
      setTypingByConversation({});
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();
  }, [user]);

  useEffect(() => {
    if (!INTERNAL_CHAT_REALTIME_ENABLED || !user) return;

    return openInternalChatRealtimeStream(
      (event: InternalChatRealtimeEvent) => {
        const currentConversationKey = selectedConversationKeyRef.current;
        const launcherOpen = isOpenRef.current;
        const launcherMinimized = isMinimizedRef.current;

        if (event.type === 'conversation.read') {
          if (currentConversationKey === event.conversation_key) {
            void refreshConversationMessages(event.conversation_key, false);
          }
          void loadShellData({ background: true });
          return;
        }

        if (event.type === 'reaction.updated') {
          if (currentConversationKey === event.conversation_key) {
            void refreshConversationMessages(event.conversation_key, false);
          }
          return;
        }

        if (event.type === 'typing.updated') {
          setTypingByConversation((prev) => ({
            ...prev,
            [event.conversation_key]: (event.typing_user_ids || []).filter((typingUserId) => typingUserId !== user.id),
          }));
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
  }, [addToast, user]);

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
    if (!isOpen || isMinimized) {
      stopTyping(selectedConversationKeyRef.current);
    }
  }, [isMinimized, isOpen]);

  useEffect(() => () => {
    stopTyping();
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
  const selectedTypingUserIds = selectedConversationKey ? typingByConversation[selectedConversationKey] || [] : [];
  const selectedTypingLabel = selectedTypingUserIds
    .map((userId) => participantMap.get(userId)?.full_name?.trim() || `User ${userId}`)
    .filter(Boolean)
    .join(', ');

  const setMessageRef = (messageId: string, node: HTMLDivElement | null) => {
    if (node) {
      messageRefs.current[messageId] = node;
      return;
    }

    delete messageRefs.current[messageId];
  };

  const setMessageActionRef = (messageId: string, node: HTMLDivElement | null) => {
    if (node) {
      messageActionRefs.current[messageId] = node;
      return;
    }

    delete messageActionRefs.current[messageId];
  };

  const enterReplyMode = (message: InternalChatMessage) => {
    setReplyTarget({
      message_id: message.id,
      sender_id: message.sender_id,
      sender_name: message.sender_name,
      message: message.message,
      is_from_current_user: message.is_from_current_user,
    });
    setOpenMessageActionId(null);
    setOpenReactionPickerId(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const jumpToOriginalMessage = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
      highlightTimeoutRef.current = null;
    }, MESSAGE_HIGHLIGHT_MS);
  };

  useEffect(() => {
    if (!selectedConversationKey) return;
    requestAnimationFrame(() => {
      if (messageBottomRef.current) {
        messageBottomRef.current.scrollIntoView({ block: 'end' });
        return;
      }

      if (messageViewportRef.current) {
        const viewport = messageViewportRef.current;
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }, [selectedConversationKey, selectedMessages.length, selectedTypingUserIds.length]);

  useEffect(() => {
    setOpenMessageActionId(null);
    setOpenReactionPickerId(null);
    setReplyTarget(null);
  }, [selectedConversationKey]);

  useEffect(() => {
    if (!replyTarget) return;

    const activeMentionRecipientIds = Object.entries(mentionSelections)
      .filter(([, token]) => token && draft.includes(token))
      .map(([participantId]) => participantId)
      .filter((participantId) => participantId !== selectedOtherParticipant?.id);

    if (activeMentionRecipientIds.length > 0) {
      setReplyTarget(null);
    }
  }, [draft, mentionSelections, replyTarget, selectedOtherParticipant]);

  useEffect(() => {
    if (!openMessageActionId || typeof document === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = messageActionRefs.current[openMessageActionId];
      if (!container) {
        setOpenMessageActionId(null);
        setOpenReactionPickerId(null);
        return;
      }

      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }

      setOpenMessageActionId(null);
      setOpenReactionPickerId(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [openMessageActionId]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!openMessageActionId) {
      setOpenReactionPickerId(null);
    }
  }, [openMessageActionId]);

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

    stopTyping(selectedConversationKeyRef.current);
    setIsOpen(false);
  };

  const handleSelectConversation = (conversationKey: string) => {
    if (selectedConversationKeyRef.current && selectedConversationKeyRef.current !== conversationKey) {
      stopTyping(selectedConversationKeyRef.current);
    }
    setOpenMessageActionId(null);
    setOpenReactionPickerId(null);
    setReplyTarget(null);
    selectedConversationKeyRef.current = conversationKey;
    setSelectedConversationKey(conversationKey);
    setIsOpen(true);
    setIsMinimized(false);
  };

  const handleDraftChange = (value: string, cursorPosition: number) => {
    setDraft(value);
    setMentionContext(getMentionContext(value, cursorPosition));
    scheduleTypingUpdate(value, selectedConversationKeyRef.current);
  };

  const insertMention = (participant: InternalChatParticipant) => {
    if (!textareaRef.current || !mentionContext) return;
    const token = `@${participantLabel(participant)}`;
    const nextValue =
      `${draft.slice(0, mentionContext.start)}${token} ${draft.slice(mentionContext.end)}`;

    setDraft(nextValue);
    scheduleTypingUpdate(nextValue, selectedConversationKeyRef.current);
    setMentionSelections((prev) => ({
      ...prev,
      [participant.id]: token,
    }));
    setMentionContext(null);
    if (replyTarget && participant.id !== selectedOtherParticipant?.id) {
      setReplyTarget(null);
    }

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

    const canAttachReply =
      Boolean(replyTarget) &&
      Boolean(selectedConversationKey) &&
      recipientIds.length === 1 &&
      selectedOtherParticipant?.id === recipientIds[0];
    const activeReplyTarget = canAttachReply ? replyTarget : null;
    if (replyTarget && !activeReplyTarget) {
      setReplyTarget(null);
    }

    setIsSending(true);
    setOpenMessageActionId(null);
    setOpenReactionPickerId(null);
    const previousDraft = draft;
    const pendingCreatedAt = new Date().toISOString();
    const pendingMessages: InternalChatMessage[] = recipientIds.map((recipientId) => {
      const conversationKey =
        selectedConversationKey && selectedOtherParticipant?.id === recipientId
          ? selectedConversationKey
          : buildDirectConversationKey(user.id, recipientId);

      return {
        id: `pending:${conversationKey}:${recipientId}:${Date.now()}`,
        conversation_key: conversationKey,
        sender_id: user.id,
        recipient_id: recipientId,
        message: trimmedMessage,
        created_at: pendingCreatedAt,
        is_from_current_user: true,
        sender_name: user.full_name || 'You',
        recipient_name: participantMap.get(recipientId)?.full_name || `User ${recipientId}`,
        sender_avatar_url: user.avatar_url || '',
        recipient_avatar_url: participantMap.get(recipientId)?.avatar_url || '',
        delivery_status: 'sent',
        is_read_by_recipient: false,
        reactions: [],
        current_user_reaction: null,
        reply_to_message_id: activeReplyTarget?.message_id ?? null,
        reply_preview: activeReplyTarget
          ? {
              ...activeReplyTarget,
              is_available: true,
            }
          : null,
        is_pending: true,
      };
    });

    setMessagesByConversation((prev) => mergeConversationMessages(prev, pendingMessages));
    setDraft('');
    setMentionSelections({});
    setMentionContext(null);
    stopTyping(selectedConversationKeyRef.current);

    try {
      const created = await sendInternalChatMessage({
        message: trimmedMessage,
        conversationKey: selectedConversationKey || undefined,
        recipientIds,
        replyToMessageId: activeReplyTarget?.message_id,
      });

      setMessagesByConversation((prev) => {
        const withoutPending = removeConversationMessages(prev, pendingMessages.map((message) => message.id));
        return created.length > 0 ? mergeConversationMessages(withoutPending, created) : withoutPending;
      });
      setReplyTarget(null);

      await loadShellData({ background: true });

      if (!selectedConversationKey && created[0]?.conversation_key) {
        setSelectedConversationKey(created[0].conversation_key);
      }
    } catch (error) {
      setMessagesByConversation((prev) => removeConversationMessages(prev, pendingMessages.map((message) => message.id)));
      setDraft(previousDraft);
      addToast({
        type: 'error',
        title: 'Unable to send message',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleReaction = async (
    message: InternalChatMessage,
    emoji: string,
    options?: { collapseAfter?: boolean }
  ) => {
    if (!user || reactionPendingIds[message.id]) return;

    if (options?.collapseAfter) {
      setOpenMessageActionId(null);
      setOpenReactionPickerId(null);
    }

    const previousMessage = {
      reactions: [...(message.reactions || [])],
      current_user_reaction: message.current_user_reaction,
    };

    setReactionPendingIds((prev) => ({ ...prev, [message.id]: true }));
    setMessagesByConversation((prev) =>
      updateConversationMessage(prev, message.conversation_key, message.id, (current) => ({
        ...current,
        ...toggleReactionState(current, emoji),
      }))
    );

    try {
      const payload = await toggleInternalChatReaction(message.id, emoji);
      setMessagesByConversation((prev) =>
        updateConversationMessage(prev, message.conversation_key, message.id, (current) => ({
          ...current,
          reactions: payload.reactions || [],
          current_user_reaction: payload.current_user_reaction ?? null,
        }))
      );
    } catch (error) {
      setMessagesByConversation((prev) =>
        updateConversationMessage(prev, message.conversation_key, message.id, (current) => ({
          ...current,
          reactions: previousMessage.reactions,
          current_user_reaction: previousMessage.current_user_reaction,
        }))
      );
      addToast({
        type: 'error',
        title: 'Unable to update reaction',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setReactionPendingIds((prev) => {
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
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
                  onClick={() => {
                    stopTyping(selectedConversationKeyRef.current);
                    setIsMinimized(true);
                  }}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Minimize chat"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    stopTyping(selectedConversationKeyRef.current);
                    setIsOpen(false);
                  }}
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
                        {avatarFallback(participantLabel(participant))}
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
                  {avatarFallback(selectedOtherParticipant ? participantLabel(selectedOtherParticipant) : 'Chat')}
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
                onClick={() => {
                  stopTyping(selectedConversationKeyRef.current);
                  setIsMinimized(true);
                }}
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Collapse chat"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div ref={messageViewportRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-5 py-4 pb-6">
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
                  const isActionOpen = openMessageActionId === message.id;
                  const isHighlighted = highlightedMessageId === message.id;
                  const replyPreview = message.reply_preview;
                  const replyPreviewText =
                    replyPreview?.is_available === false
                      ? 'Original message unavailable'
                      : truncateReplyText(replyPreview?.message || '');
                  const isReactionPickerOpen = openReactionPickerId === message.id;

                  return (
                    <div
                      key={message.id}
                      ref={(node) => setMessageRef(message.id, node)}
                      className={`group flex scroll-mt-24 transition-all duration-300 ${isMine ? 'justify-end' : 'justify-start'} ${
                        isHighlighted ? 'animate-pulse rounded-3xl ring-2 ring-brand-blue/30 ring-offset-2 ring-offset-slate-50' : ''
                      }`}
                    >
                      <div
                        ref={(node) => setMessageActionRef(message.id, node)}
                        className="relative w-fit max-w-[78%]"
                      >
                        <div
                          className={`absolute top-1/2 z-10 -translate-y-1/2 items-center gap-1 transition ${
                            isMine ? 'right-full mr-3' : 'left-full ml-3'
                          } ${
                            isActionOpen
                              ? 'flex opacity-100'
                              : 'pointer-events-none flex opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMessageActionId(message.id);
                              setOpenReactionPickerId((current) => (current === message.id ? null : message.id));
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-brand-blue"
                            aria-label={`React to message ${message.id}`}
                          >
                            <SmilePlus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              enterReplyMode(message);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-brand-blue"
                            aria-label={`Reply to message ${message.id}`}
                          >
                            <CornerUpLeft className="h-4 w-4" />
                          </button>
                        </div>
                        <div>
                          <div
                            onClick={() => {
                              setOpenMessageActionId((current) => (current === message.id ? null : message.id));
                              setOpenReactionPickerId(null);
                            }}
                            className={`cursor-pointer rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'bg-brand-blue text-white' : 'bg-white text-slate-900 border border-slate-200'}`}
                          >
                            <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
                              <span className="font-semibold">{isMine ? 'You' : message.sender_name}</span>
                              <span>{formatRelativeTime(message.created_at)}</span>
                            </div>
                            {replyPreview && (
                              <>
                                {replyPreview.is_available === false ? (
                                  <div
                                    className={`mb-3 rounded-2xl border px-3 py-2 text-left ${
                                      isMine
                                        ? 'border-white/15 bg-white/10 text-white/85'
                                        : 'border-slate-200 bg-slate-50 text-slate-600'
                                    }`}
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Original message unavailable</p>
                                    <p className="mt-1 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{replyPreviewText}</p>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      jumpToOriginalMessage(replyPreview.message_id);
                                    }}
                                    className={`mb-3 block w-full rounded-2xl border px-3 py-2 text-left transition ${
                                      isMine
                                        ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/15'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-blue/30 hover:bg-white'
                                    }`}
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                      Replying to {replySenderLabel(replyPreview)}
                                    </p>
                                    <p className="mt-1 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{replyPreviewText}</p>
                                  </button>
                                )}
                              </>
                            )}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                          </div>
                          {isActionOpen && isReactionPickerOpen && (
                            <div className={`mt-2 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg shadow-slate-900/10">
                                {REACTION_OPTIONS.map((emoji) => (
                                  <button
                                    key={`${message.id}:picker:${emoji}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleToggleReaction(message, emoji, { collapseAfter: true });
                                    }}
                                    disabled={Boolean(reactionPendingIds[message.id])}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                                      message.current_user_reaction === emoji
                                        ? 'bg-brand-blue/10'
                                        : 'hover:bg-slate-100'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                    aria-label={`React with ${emoji}`}
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className={`mt-2 flex flex-wrap items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {message.reactions.length > 0 && (
                              <>
                                {message.reactions.map((reaction) => (
                                  <button
                                    key={`${message.id}:${reaction.emoji}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleToggleReaction(message, reaction.emoji);
                                    }}
                                    disabled={Boolean(reactionPendingIds[message.id])}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                                      reaction.reacted_by_current_user
                                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/30 hover:text-brand-blue'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                          <div className={`mt-1 flex items-center gap-2 text-[11px] text-slate-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {isMine && (
                              <span className={message.delivery_status === 'read' && !message.is_pending ? 'text-brand-blue' : ''}>
                                {formatDeliveryStatus(message)}
                              </span>
                            )}
                            {Boolean(reactionPendingIds[message.id]) && <span>Updating reaction...</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {selectedConversationKey && selectedTypingUserIds.length > 0 && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
                    {selectedTypingLabel || 'Someone'} is typing...
                  </div>
                </div>
              )}
              <div ref={messageBottomRef} aria-hidden="true" />
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4">
              {replyTarget && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
                      Replying to {replySenderLabel(replyTarget)}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{truncateReplyText(replyTarget.message)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
                    aria-label="Dismiss reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
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
                  onBlur={() => stopTyping(selectedConversationKeyRef.current)}
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
                            {avatarFallback(participantLabel(participant))}
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
