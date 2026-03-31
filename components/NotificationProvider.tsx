import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Notification } from '../types';
import {
  fetchNotifications,
  getUnreadCount,
  markAsRead,
  markNotificationsAsReadByEntityKey,
  markAllAsRead,
  deleteNotification,
  triggerInventoryAlertScan,
} from '../services/notificationLocalApiService';

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
  const notificationsRef = useRef<Notification[]>([]);
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const refreshRequestIdRef = useRef(0);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Fetch initial notifications
  const refreshNotifications = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(userId),
        getUnreadCount(userId),
      ]);
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }

      const safeNotifications = Array.isArray(notifs) ? notifs : [];
      setNotifications(safeNotifications);
      notificationsRef.current = safeNotifications;
      setUnreadCount(count);
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  // Initial fetch on mount and when userId changes
  useEffect(() => {
    refreshNotifications();
  }, [userId, refreshNotifications]);

  useEffect(() => {
    void triggerInventoryAlertScan().then(() => refreshNotifications());

    const intervalId = window.setInterval(() => {
      void triggerInventoryAlertScan().then(() => refreshNotifications());
    }, 10 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshNotifications]);

  // Refresh notifications on a polling interval while we finish the local API migration.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshNotifications();
    }, 30000);

    const handleFocus = () => {
      void refreshNotifications();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
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
          ? await markNotificationsAsReadByEntityKey(userId, readTarget)
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
        let locallyUpdatedUnreadCount = 0;

        setNotifications((prev) => {
          const nextNotifications = prev.map((notif) => {
            if (!updatedIdSet.has(notif.id)) {
              return notif;
            }

            if (!notif.is_read) {
              locallyUpdatedUnreadCount += 1;
            }

            return { ...notif, is_read: true, read_at: notif.read_at || readAt };
          });
          notificationsRef.current = nextNotifications;
          return nextNotifications;
        });

        if (locallyUpdatedUnreadCount > 0) {
          setUnreadCount((prev) => Math.max(0, prev - locallyUpdatedUnreadCount));
        }
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
    const pendingReadIds = notificationsRef.current
      .filter((notif) => !notif.is_read)
      .map((notif) => notif.id);

    pendingReadIds.forEach((id) => pendingReadIdsRef.current.add(id));

    try {
      const success = await markAllAsRead(userId);
      if (!success) {
        return;
      }

      const readAt = new Date().toISOString();
      let locallyUpdatedUnreadCount = 0;

      setNotifications((prev) => {
        const nextNotifications = prev.map((notif) => {
          if (notif.is_read) {
            return notif;
          }

          locallyUpdatedUnreadCount += 1;
          return {
            ...notif,
            is_read: true,
            read_at: notif.read_at || readAt,
          };
        });
        notificationsRef.current = nextNotifications;
        return nextNotifications;
      });

      if (locallyUpdatedUnreadCount > 0) {
        setUnreadCount((prev) => Math.max(0, prev - locallyUpdatedUnreadCount));
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      pendingReadIds.forEach((id) => pendingReadIdsRef.current.delete(id));
    }
  }, [userId]);

  // Handle delete notification
  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await deleteNotification(id);
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
