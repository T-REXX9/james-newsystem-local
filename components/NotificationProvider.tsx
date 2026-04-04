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

const MAX_NOTIFICATIONS = 500;
const INVENTORY_SCAN_INTERVAL_MS = 10 * 60 * 1000;
const INVENTORY_SCAN_THROTTLE_KEY = 'notification_inventory_scan_started_at';
const INVENTORY_SCAN_DEFER_MS = 5000;

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notification: Notification) => Promise<void>;
  markManyAsRead: (notifications: Notification[]) => Promise<void>;
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

  const applyOptimisticReadState = useCallback((ids: string[], readAt: string) => {
    if (ids.length === 0) {
      return 0;
    }

    const idSet = new Set(ids);
    let countMarkedRead = 0;

    setNotifications((prev) => {
      const nextNotifications = prev.map((notif) => {
        if (!idSet.has(notif.id) || notif.is_read) {
          return notif;
        }

        countMarkedRead += 1;
        return {
          ...notif,
          is_read: true,
          read_at: notif.read_at || readAt,
        };
      });

      notificationsRef.current = nextNotifications;
      return nextNotifications;
    });

    if (countMarkedRead > 0) {
      setUnreadCount((prev) => Math.max(0, prev - countMarkedRead));
    }

    return countMarkedRead;
  }, []);

  const revertOptimisticReadState = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);
    let countRestoredUnread = 0;

    setNotifications((prev) => {
      const nextNotifications = prev.map((notif) => {
        if (!idSet.has(notif.id) || !notif.is_read) {
          return notif;
        }

        countRestoredUnread += 1;
        return {
          ...notif,
          is_read: false,
          read_at: null,
        };
      });

      notificationsRef.current = nextNotifications;
      return nextNotifications;
    });

    if (countRestoredUnread > 0) {
      setUnreadCount((prev) => prev + countRestoredUnread);
    }
  }, []);

  // Fetch initial notifications
  const refreshNotifications = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(userId, MAX_NOTIFICATIONS),
        getUnreadCount(userId),
      ]);
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }

      const pendingReadIds = pendingReadIdsRef.current;
      const safeNotifications = (Array.isArray(notifs) ? notifs : []).map((notif) => {
        if (!pendingReadIds.has(notif.id) || notif.is_read) {
          return notif;
        }

        return {
          ...notif,
          is_read: true,
          read_at: notif.read_at || new Date().toISOString(),
        };
      });
      const pendingUnreadLoadedCount = safeNotifications.filter(
        (notif) => pendingReadIds.has(notif.id) && !notifs.find((serverNotif) => serverNotif.id === notif.id)?.is_read
      ).length;

      const serverUnreadCount = Math.max(0, count - pendingUnreadLoadedCount);
      const loadedUnreadCount = safeNotifications.filter((notif) => !notif.is_read).length;
      const effectiveUnreadCount = safeNotifications.length < MAX_NOTIFICATIONS
        ? loadedUnreadCount
        : Math.max(serverUnreadCount, loadedUnreadCount);

      setNotifications(safeNotifications);
      notificationsRef.current = safeNotifications;
      setUnreadCount(effectiveUnreadCount);
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

  // Enable inventory alert scanning with 10-minute intervals
  useEffect(() => {
    const canStartInventoryScan = () => {
      if (typeof window === 'undefined') {
        return true;
      }

      const lastStartedAt = Number(window.localStorage.getItem(INVENTORY_SCAN_THROTTLE_KEY) || 0);
      const now = Date.now();
      if (Number.isFinite(lastStartedAt) && lastStartedAt > 0 && now - lastStartedAt < INVENTORY_SCAN_INTERVAL_MS) {
        return false;
      }

      window.localStorage.setItem(INVENTORY_SCAN_THROTTLE_KEY, String(now));
      return true;
    };

    const runInventoryScan = () => {
      if (!canStartInventoryScan()) {
        return;
      }

      void triggerInventoryAlertScan().then(() => {
        void refreshNotifications();
      });
    };

    const startupScanTimeoutId = window.setTimeout(runInventoryScan, INVENTORY_SCAN_DEFER_MS);

    const intervalId = window.setInterval(() => {
      runInventoryScan();
    }, INVENTORY_SCAN_INTERVAL_MS);

    return () => {
      window.clearTimeout(startupScanTimeoutId);
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

  const handleMarkManyAsRead = useCallback(
    async (inputNotifications: Notification[]) => {
      const unreadNotifications = inputNotifications.filter((notification) => !notification.is_read);
      if (unreadNotifications.length === 0) {
        return;
      }

      const groups = new Map<string, { target: ReturnType<typeof getNotificationReadTarget>; notifications: Notification[] }>();
      const directNotifications: Notification[] = [];

      unreadNotifications.forEach((notification) => {
        const readTarget = getNotificationReadTarget(notification);
        if (!readTarget) {
          directNotifications.push(notification);
          return;
        }

        const groupKey = 'entityType' in readTarget
          ? `entity:${readTarget.entityType}:${readTarget.entityId}`
          : `refno:${readTarget.refno}`;
        const existingGroup = groups.get(groupKey);
        if (existingGroup) {
          existingGroup.notifications.push(notification);
          return;
        }

        groups.set(groupKey, {
          target: readTarget,
          notifications: [notification],
        });
      });

      const pendingIds = new Set<string>();
      groups.forEach(({ notifications: groupedNotifications }) => {
        groupedNotifications.forEach((notification) => pendingIds.add(notification.id));
      });
      directNotifications.forEach((notification) => pendingIds.add(notification.id));

      const pendingReadIds = Array.from(pendingIds);
      const readAt = new Date().toISOString();

      pendingReadIds.forEach((id) => pendingReadIdsRef.current.add(id));
      applyOptimisticReadState(pendingReadIds, readAt);

      try {
        const groupOperations = Array.from(groups.values()).map(async ({ target, notifications: groupedNotifications }) => {
          const fallbackIds = groupedNotifications.map((notif) => notif.id);
          const result = await markNotificationsAsReadByEntityKey(userId, target || {});
          return {
            success: result.success,
            ids: result.updatedIds.length > 0 ? result.updatedIds : fallbackIds,
          };
        });

        const directOperations = directNotifications.map(async (notification) => ({
          success: await markAsRead(notification.id),
          ids: [notification.id],
        }));

        const results = await Promise.all([...groupOperations, ...directOperations]);
        const failedIds = results
          .filter((result) => !result.success)
          .flatMap((result) => result.ids);

        if (failedIds.length > 0) {
          revertOptimisticReadState(failedIds);
        }
      } catch (err) {
        console.error('Error marking notifications as read:', err);
        revertOptimisticReadState(pendingReadIds);
      } finally {
        pendingReadIds.forEach((id) => pendingReadIdsRef.current.delete(id));
      }
    },
    [applyOptimisticReadState, revertOptimisticReadState, userId]
  );

  // Handle mark as read
  const handleMarkAsRead = useCallback(
    async (notification: Notification) => {
      await handleMarkManyAsRead([notification]);
    },
    [handleMarkManyAsRead]
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

      setNotifications((prev) => {
        const nextNotifications = prev.map((notif) => {
          if (notif.is_read) {
            return notif;
          }

          return {
            ...notif,
            is_read: true,
            read_at: notif.read_at || readAt,
          };
        });
        notificationsRef.current = nextNotifications;
        return nextNotifications;
      });

      // Fetch the actual unread count from the server to ensure accuracy
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
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
    markManyAsRead: handleMarkManyAsRead,
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
