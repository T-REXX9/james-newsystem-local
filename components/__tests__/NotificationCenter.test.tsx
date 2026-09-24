import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationProvider } from '../NotificationProvider';
import NotificationCenter from '../NotificationCenter';
import type { Notification } from '../../types';

const fetchNotificationsMock = vi.fn();
const getNotificationApiAvailabilityMock = vi.fn();
const getUnreadCountMock = vi.fn();
const markAsReadMock = vi.fn();
const markNotificationsAsReadByEntityKeyMock = vi.fn();
const markAllAsReadMock = vi.fn();
const deleteNotificationMock = vi.fn();
const triggerInventoryAlertScanMock = vi.fn();

vi.mock('../../services/notificationLocalApiService', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  getNotificationApiAvailability: (...args: unknown[]) => getNotificationApiAvailabilityMock(...args),
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
    getNotificationApiAvailabilityMock.mockReset();
    getUnreadCountMock.mockReset();
    markAsReadMock.mockReset();
    markNotificationsAsReadByEntityKeyMock.mockReset();
    markAllAsReadMock.mockReset();
    deleteNotificationMock.mockReset();
    triggerInventoryAlertScanMock.mockReset();

    getNotificationApiAvailabilityMock.mockReturnValue({
      isReachable: true,
      retryAt: null,
      lastFailureAt: null,
    });
    triggerInventoryAlertScanMock.mockResolvedValue([]);
    deleteNotificationMock.mockResolvedValue(true);
    markAllAsReadMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
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
      expect(fetchNotificationsMock).toHaveBeenCalledWith(
        'user-1',
        100,
        undefined,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
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

    await waitFor(() => {
      expect(markAsReadMock).toHaveBeenCalledWith('notif-direct');
    });
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

  it('opens the Daily Call Monitoring for Agent Sales Report notifications', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({
        id: 'sales-report-1',
        category: 'notification',
        type: 'info',
        title: 'Agent Sales Report - Acme Corp',
        action_url: 'home',
        metadata: {
          entity_type: 'call_report_reply',
          entity_id: 'message-1',
          contact_id: 'customer-42',
          conversation_type: 'agent_sales_report',
          category: 'notification',
        },
      }),
    ]);
    getUnreadCountMock.mockResolvedValue(1);
    markAsReadMock.mockResolvedValue(true);
    markNotificationsAsReadByEntityKeyMock.mockResolvedValue({
      success: true,
      updatedCount: 1,
      updatedIds: ['sales-report-1'],
      readAt: '2026-04-04T01:00:00.000Z',
    });
    const navigationHandler = vi.fn();
    window.addEventListener('workflow:navigate', navigationHandler);

    const user = userEvent.setup();
    renderNotificationCenter();
    await user.click(screen.getByTitle('Notifications'));
    await user.dblClick(screen.getByText('Agent Sales Report - Acme Corp'));

    expect(navigationHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        tab: 'sales-transaction-daily-call-monitoring',
        payload: { contactId: 'customer-42', conversationType: 'agent_sales_report', activityRef: 'message-1' },
      },
    }));
    window.removeEventListener('workflow:navigate', navigationHandler);
  });

  it('opens Daily Call Monitoring for an approval decision without conversation metadata', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({
        id: 'customer-request-decision-1',
        category: 'notification',
        title: 'Customer update approved',
        action_url: 'sales-transaction-daily-call-monitoring',
        metadata: {
          entity_type: 'customer_request_decision',
          entity_id: 'request-1',
          contact_id: 'customer-42',
          category: 'notification',
        },
      }),
    ]);
    getUnreadCountMock.mockResolvedValue(1);
    markAsReadMock.mockResolvedValue(true);
    const navigationHandler = vi.fn();
    window.addEventListener('workflow:navigate', navigationHandler);

    const user = userEvent.setup();
    renderNotificationCenter();
    await user.click(screen.getByTitle('Notifications'));
    await user.dblClick(screen.getByText('Customer update approved'));

    expect(navigationHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        tab: 'sales-transaction-daily-call-monitoring',
        payload: { contactId: 'customer-42', conversationType: 'agent_sales_report', activityRef: 'request-1' },
      },
    }));
    window.removeEventListener('workflow:navigate', navigationHandler);
  });

  it('opens the exact prospect in Customer Data for its unified conversation comment', async () => {
    fetchNotificationsMock.mockResolvedValue([
      createNotification({
        id: 'prospect-comment-1',
        category: 'notification',
        type: 'info',
        title: 'New prospective customer comment',
        action_url: 'home',
        metadata: {
          entity_type: 'prospect_customer_comment',
          entity_id: 'prospect-42',
          contact_id: 'prospect-42',
          category: 'notification',
        },
      }),
    ]);
    getUnreadCountMock.mockResolvedValue(1);
    markAsReadMock.mockResolvedValue(true);
    markNotificationsAsReadByEntityKeyMock.mockResolvedValue({
      success: true,
      updatedCount: 1,
      updatedIds: ['prospect-comment-1'],
      readAt: '2026-04-04T01:00:00.000Z',
    });
    const navigationHandler = vi.fn();
    window.addEventListener('workflow:navigate', navigationHandler);

    const user = userEvent.setup();
    renderNotificationCenter();
    await user.click(screen.getByTitle('Notifications'));
    await user.dblClick(screen.getByText('New prospective customer comment'));

    expect(navigationHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        tab: 'sales-database-customer-database',
        payload: { contactId: 'prospect-42', conversationType: 'agent_sales_report', activityRef: 'prospect-42' },
      },
    }));
    window.removeEventListener('workflow:navigate', navigationHandler);
  });

  it.each([
    ['sales_inquiry', 'inquiryId', 'sales-transaction-sales-inquiry'],
    ['sales_order', 'orderId', 'sales-transaction-sales-order'],
    ['order_slip', 'orderSlipId', 'sales-transaction-order-slip'],
    ['invoice', 'invoiceId', 'sales-transaction-invoice'],
    ['purchase_request', 'prId', 'warehouse-purchasing-purchase-request'],
    ['purchase_order', 'poId', 'warehouse-purchasing-purchase-order'],
    ['receiving_report', 'rrId', 'warehouse-purchasing-receiving-stock'],
  ])('opens the selected %s record', async (entityType, payloadKey, tab) => {
    fetchNotificationsMock.mockResolvedValue([createNotification({
      id: `route-${entityType}`,
      title: `Route ${entityType}`,
      category: 'notification',
      action_url: tab,
      metadata: { entity_type: entityType, entity_id: 'record-42', category: 'notification' },
    })]);
    getUnreadCountMock.mockResolvedValue(1);
    const navigationHandler = vi.fn();
    window.addEventListener('workflow:navigate', navigationHandler);
    const user = userEvent.setup();
    renderNotificationCenter();
    await user.click(screen.getByTitle('Notifications'));
    fireEvent.doubleClick(screen.getByText(`Route ${entityType}`));
    expect(navigationHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: { tab, payload: { [payloadKey]: 'record-42' } },
    }));
    window.removeEventListener('workflow:navigate', navigationHandler);
  });

  it('ignores stale refresh results that finish after a notification is marked as read', async () => {
    const unreadNotification = createNotification({
      id: 'notif-race',
      category: 'notification',
      type: 'info',
      title: 'Race notification',
      metadata: undefined,
    });
    const readNotification = {
      ...unreadNotification,
      is_read: true,
      read_at: '2026-04-04T01:00:00.000Z',
    };

    const staleNotifications = createDeferred<Notification[]>();
    const staleCount = createDeferred<number>();
    const refreshedNotifications = createDeferred<Notification[]>();
    const refreshedCount = createDeferred<number>();

    fetchNotificationsMock
      .mockResolvedValueOnce([unreadNotification])
      .mockReturnValueOnce(staleNotifications.promise)
      .mockReturnValueOnce(refreshedNotifications.promise);
    getUnreadCountMock
      .mockResolvedValueOnce(1)
      .mockReturnValueOnce(staleCount.promise)
      .mockReturnValueOnce(refreshedCount.promise);
    markAsReadMock.mockResolvedValue(true);

    const user = userEvent.setup();
    renderNotificationCenter();

    await screen.findByText('1');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await user.click(screen.getByTitle('Notifications'));
    await user.click(screen.getByText('Race notification'));

    const bellButton = screen.getByTitle('Notifications');
    await waitFor(() => {
      expect(within(bellButton).queryByText('1')).not.toBeInTheDocument();
    });

    staleNotifications.resolve([unreadNotification]);
    staleCount.resolve(1);
    refreshedNotifications.resolve([readNotification]);
    refreshedCount.resolve(0);

    await waitFor(() => {
      expect(within(bellButton).queryByText('1')).not.toBeInTheDocument();
    });
  });

  it('skips automatic polling and startup inventory scans while the notification API is in backoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T08:00:00.000Z'));
    fetchNotificationsMock.mockResolvedValue([]);
    getUnreadCountMock.mockResolvedValue(0);

    renderNotificationCenter();

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    expect(getUnreadCountMock).toHaveBeenCalledTimes(1);

    const retryAt = Date.parse('2026-04-13T08:02:00.000Z');
    const lastFailureAt = Date.parse('2026-04-13T08:00:00.000Z');
    getNotificationApiAvailabilityMock.mockImplementation(() => ({
      isReachable: Date.now() >= retryAt,
      retryAt,
      lastFailureAt,
    }));

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(triggerInventoryAlertScanMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    expect(getUnreadCountMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    expect(getUnreadCountMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-04-13T08:02:01.000Z'));
    const fetchCallsBeforeRetry = fetchNotificationsMock.mock.calls.length;
    const unreadCallsBeforeRetry = getUnreadCountMock.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(fetchCallsBeforeRetry + 1);
    expect(getUnreadCountMock).toHaveBeenCalledTimes(unreadCallsBeforeRetry + 1);
  });
});
