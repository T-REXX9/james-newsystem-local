import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Notification } from '../types';
import {
  fetchNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../services/supabaseService';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
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

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ userId, children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const hasSubscribedRef = useRef(false);

  // Fetch initial notifications
  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(notifs);
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
          setNotifications((prev) => [newNotification, ...prev]);
          if (!newNotification.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
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
    async (id: string) => {
      try {
        await markAsRead(id);
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === id
              ? { ...notif, is_read: true, read_at: new Date().toISOString() }
              : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    []
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
  }, []);

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
