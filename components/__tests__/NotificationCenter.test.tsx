import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationProvider } from '../NotificationProvider';
import NotificationCenter from '../NotificationCenter';
import type { Notification } from '../../types';

const fetchNotificationsMock = vi.fn();
const getUnreadCountMock = vi.fn();
const markAsReadMock = vi.fn();
const markNotificationsAsReadByEntityKeyMock = vi.fn();
const markAllAsReadMock = vi.fn();
const deleteNotificationMock = vi.fn();
const triggerInventoryAlertScanMock = vi.fn();

vi.mock('../../services/notificationLocalApiService', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  getUnreadCount: (...args: unknown[]) => getUnreadCountMock(...args),
  markAsRead: (...args: unknown[]) => markAsReadMock(...args),
  markNotificationsAsReadByEntityKey: (...args: unknown[]) => markNotificationsAsReadByEntityKeyMock(...args),
  markAllAsRead: (...args: unknown[]) => markAllAsReadMock(...args),
  deleteNotification: (...args: unknown[]) => deleteNotificationMock(...args),
  triggerInventoryAlertScan: (...args: unknown[]) => triggerInventoryAlertScanMock(...args),
}));

const renderNotificationCenter = () =>
  render(
    <NotificationProvider userId="user-1">
      <NotificationCenter />
    </NotificationProvider>
  );

const createNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: overrides.id || 'notif-1',
  recipient_id: 'user-1',
  title: overrides.title || 'Test notification',
  message: overrides.message || 'Test message',
  type: overrides.type || 'warning',
  category: overrides.category || 'alert',
  action_url: overrides.action_url,
  metadata: overrides.metadata,
  is_read: overrides.is_read ?? false,
  created_at: overrides.created_at || '2026-04-04T00:00:00.000Z',
  read_at: overrides.read_at,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    getUnreadCountMock.mockReset();
    markAsReadMock.mockReset();
    markNotificationsAsReadByEntityKeyMock.mockReset();
    markAllAsReadMock.mockReset();
    deleteNotificationMock.mockReset();
    triggerInventoryAlertScanMock.mockReset();

    triggerInventoryAlertScanMock.mockResolvedValue([]);
    deleteNotificationMock.mockResolvedValue(true);
    markAllAsReadMock.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the loaded unread total when the fetched notification list is complete', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({ id: 'alert-1', is_read: true, title: 'Alert 1' }),
      createNotification({ id: 'alert-2', is_read: true, title: 'Alert 2' }),
    ]);
    getUnreadCountMock.mockResolvedValue(125);

    const user = userEvent.setup();
    renderNotificationCenter();

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledWith('user-1', 500);
    });

    const bellButton = screen.getByTitle('Notifications');
    expect(within(bellButton).queryByText('99+')).not.toBeInTheDocument();

    await user.click(bellButton);

    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('optimistically clears the badge and batches tab mark-as-read requests by entity key', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({
        id: 'alert-1',
        title: 'Inventory Out of Stock A',
        metadata: {
          actor_id: 'system',
          actor_role: 'system',
          entity_type: 'inventory',
          entity_id: 'prod-1',
          severity: 'warning',
          category: 'alert',
          action: 'critical_stock',
          status: 'active',
          idempotency_key: 'alert-1',
          refno: 'inventory:prod-1',
        },
      }),
      createNotification({
        id: 'alert-2',
        title: 'Inventory Out of Stock B',
        metadata: {
          actor_id: 'system',
          actor_role: 'system',
          entity_type: 'inventory',
          entity_id: 'prod-1',
          severity: 'warning',
          category: 'alert',
          action: 'critical_stock',
          status: 'active',
          idempotency_key: 'alert-2',
          refno: 'inventory:prod-1',
        },
      }),
    ]);
    getUnreadCountMock.mockResolvedValue(2);

    const deferred = createDeferred<{ success: boolean; updatedCount: number; updatedIds: string[]; readAt: string }>();
    markNotificationsAsReadByEntityKeyMock.mockReturnValue(deferred.promise);

    const user = userEvent.setup();
    renderNotificationCenter();

    await screen.findByText('2');
    await user.click(screen.getByTitle('Notifications'));
    await user.click(screen.getByRole('button', { name: 'Alerts2' }));
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(markNotificationsAsReadByEntityKeyMock).toHaveBeenCalledTimes(1);
    expect(markNotificationsAsReadByEntityKeyMock).toHaveBeenCalledWith('user-1', {
      entityType: 'inventory',
      entityId: 'prod-1',
    });
    expect(markAsReadMock).not.toHaveBeenCalled();

    const bellButton = screen.getByTitle('Notifications');
    await waitFor(() => {
      expect(within(bellButton).queryByText('2')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();

    deferred.resolve({
      success: true,
      updatedCount: 2,
      updatedIds: ['alert-1', 'alert-2'],
      readAt: '2026-04-04T01:00:00.000Z',
    });

    await waitFor(() => {
      expect(screen.getByText('Inventory Out of Stock A')).toBeInTheDocument();
    });
  });

  it('falls back to direct mark-as-read for notifications without a metadata entity key', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({
        id: 'notif-direct',
        category: 'notification',
        type: 'info',
        title: 'Direct notification',
        metadata: undefined,
      }),
    ]);
    getUnreadCountMock.mockResolvedValue(1);

    const deferred = createDeferred<boolean>();
    markAsReadMock.mockReturnValue(deferred.promise);

    const user = userEvent.setup();
    renderNotificationCenter();

    await screen.findByText('1');
    await user.click(screen.getByTitle('Notifications'));
    await user.click(screen.getByText('Direct notification'));

    expect(markAsReadMock).toHaveBeenCalledWith('notif-direct');
    expect(markNotificationsAsReadByEntityKeyMock).not.toHaveBeenCalled();

    const bellButton = screen.getByTitle('Notifications');
    await waitFor(() => {
      expect(within(bellButton).queryByText('1')).not.toBeInTheDocument();
    });

    deferred.resolve(true);

    await waitFor(() => {
      expect(screen.getByText('Direct notification')).toBeInTheDocument();
    });
  });
});
