import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Notification } from '../types';
import {
  fetchNotifications,
  getUnreadCount,
  markAsRead,
  markNotificationsAsReadByMetadata,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../services/supabaseService';

const MAX_NOTIFICATIONS = 50;

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notification: Notification) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  userId: string;
  children: React.ReactNode;
}

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const getNotificationReadTarget = (notification: Notification) => {
  const entityType = asTrimmedString(notification.metadata?.entity_type);
  const entityId = asTrimmedString(notification.metadata?.entity_id);
  const refno = asTrimmedString(notification.metadata?.refno);

  if (entityType && entityId) {
    return { entityType, entityId };
  }

  if (refno) {
    return { refno };
  }

  return null;
};

const matchesNotificationReadTarget = (
  notification: Notification,
  target: ReturnType<typeof getNotificationReadTarget>
) => {
  if (!target) return false;

  if ('entityType' in target && target.entityType && target.entityId) {
    return (
      asTrimmedString(notification.metadata?.entity_type) === target.entityType &&
      asTrimmedString(notification.metadata?.entity_id) === target.entityId
    );
  }

  if ('refno' in target && target.refno) {
    return asTrimmedString(notification.metadata?.refno) === target.refno;
  }

  return false;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ userId, children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const hasSubscribedRef = useRef(false);
  const notificationsRef = useRef<Notification[]>([]);
  const pendingReadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Fetch initial notifications
  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(notifs);
      notificationsRef.current = notifs;
      setUnreadCount(count);
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch on mount and when userId changes
  useEffect(() => {
    refreshNotifications();
  }, [userId, refreshNotifications]);

  // Subscribe to real-time updates
  useEffect(() => {
    let isCancelled = false;
    let unsubscribe: (() => void) | null = null;
    const maxRetries = 5;
    retryCountRef.current = 0;
    hasSubscribedRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (isCancelled || retryCountRef.current >= maxRetries) {
        return;
      }
      retryCountRef.current += 1;
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      clearReconnectTimer();
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isCancelled) return;
        setupSubscription();
      }, delay);
    };

    const setupSubscription = () => {
      if (isCancelled) return;
      clearReconnectTimer();
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      unsubscribe = subscribeToNotifications(userId, {
        onInsert: (newNotification) => {
          setNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
          if (!newNotification.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        },
        onUpdate: (updatedNotification) => {
          setNotifications((prev) => {
            const existing = prev.find((notif) => notif.id === updatedNotification.id);
            const mergedNotification = existing
              ? { ...existing, ...updatedNotification }
              : updatedNotification;
            const shouldSuppressUnreadDecrement =
              mergedNotification.is_read && pendingReadIdsRef.current.has(updatedNotification.id);

            if (shouldSuppressUnreadDecrement) {
              pendingReadIdsRef.current.delete(updatedNotification.id);
            }

            if (existing && !existing.is_read && mergedNotification.is_read && !shouldSuppressUnreadDecrement) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }

            if (!existing && !mergedNotification.is_read) {
              setUnreadCount((count) => count + 1);
            }

            return existing
              ? prev.map((notif) => (notif.id === updatedNotification.id ? mergedNotification : notif))
              : [mergedNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
          });
        },
        onDelete: (notificationId) => {
          pendingReadIdsRef.current.delete(notificationId);
          setNotifications((prev) => {
            const removed = prev.find((notif) => notif.id === notificationId);
            if (removed && !removed.is_read) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }
            return prev.filter((notif) => notif.id !== notificationId);
          });
        },
        onStatusChange: (status) => {
          if (isCancelled) return;

          if (status === 'SUBSCRIBED') {
            const isReconnect = hasSubscribedRef.current || retryCountRef.current > 0;
            retryCountRef.current = 0;
            hasSubscribedRef.current = true;
            if (isReconnect) {
              refreshNotifications();
            }
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleReconnect();
          }
        },
        onError: () => {
          scheduleReconnect();
        }
      });
    };

    setupSubscription();

    return () => {
      isCancelled = true;
      clearReconnectTimer();
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, refreshNotifications]);

  // Handle mark as read
  const handleMarkAsRead = useCallback(
    async (notification: Notification) => {
      const readTarget = getNotificationReadTarget(notification);
      const pendingReadIds = readTarget
        ? notificationsRef.current
          .filter((notif) => !notif.is_read && matchesNotificationReadTarget(notif, readTarget))
          .map((notif) => notif.id)
        : notification.is_read
          ? []
          : [notification.id];

      pendingReadIds.forEach((id) => pendingReadIdsRef.current.add(id));

      try {
        const result = readTarget
          ? await markNotificationsAsReadByMetadata(userId, readTarget)
          : {
            success: await markAsRead(notification.id),
            updatedCount: notification.is_read ? 0 : 1,
            updatedIds: [notification.id],
            readAt: new Date().toISOString(),
          };

        if (!result.success) {
          return;
        }

        const updatedIds = result.updatedIds.length > 0 ? result.updatedIds : pendingReadIds;
        const updatedIdSet = new Set(updatedIds);
        const readAt = result.readAt || new Date().toISOString();

        setNotifications((prev) =>
          prev.map((notif) =>
            updatedIdSet.has(notif.id)
              ? { ...notif, is_read: true, read_at: notif.read_at || readAt }
              : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - result.updatedCount));
      } catch (err) {
        console.error('Error marking notification as read:', err);
      } finally {
        pendingReadIds.forEach((id) => pendingReadIdsRef.current.delete(id));
      }
    },
    [userId]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead(userId);
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          is_read: true,
          read_at: notif.is_read ? notif.read_at : new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [userId]);

  // Handle delete notification
  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await deleteNotification(id, userId);
      setNotifications((prev) => {
        const notification = prev.find((notif) => notif.id === id);
        if (notification && !notification.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((notif) => notif.id !== id);
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, [userId]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
