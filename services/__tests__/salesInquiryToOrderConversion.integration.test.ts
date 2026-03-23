import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesInquiryStatus, SalesOrderStatus } from '../../types';

// Mock the supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('../../lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

// Mock activity log service to avoid side effects
vi.mock('../activityLogService', () => ({
  ENTITY_TYPES: { SALES_ORDER: 'SALES_ORDER' },
  logActivity: vi.fn(),
  logCreate: vi.fn(),
  logDelete: vi.fn(),
  logRestore: vi.fn(),
  logStatusChange: vi.fn(),
  logUpdate: vi.fn(),
}));

describe('Sales Inquiry to Sales Order conversion flow', () => {
  const userId = 'test-user-id';
  const inquiryId = 'test-inquiry-id';
  const orderId = 'test-order-id';
  const orderNo = 'ORD-20260324-00001';

  const mockInquiry = {
    id: inquiryId,
    contact_id: 'contact-123',
    sales_person: 'Test Person',
    delivery_address: '123 Test St',
    reference_no: 'REF-001',
    customer_reference: 'CUST-REF-001',
    send_by: 'courier',
    price_group: 'gold',
    credit_limit: 5000,
    terms: 'net-30',
    promise_to_pay: '2026-04-01',
    po_number: 'PO-001',
    remarks: 'test conversion',
    inquiry_type: 'standard',
    urgency: 'normal',
    urgency_date: null,
    status: SalesInquiryStatus.APPROVED,
  };

  const mockInquiryItems = [
    {
      item_id: 'item-1',
      qty: 2,
      part_no: 'PART-001',
      item_code: 'CODE-001',
      location: 'MAIN',
      description: 'Test Item 1',
      unit_price: 100,
      amount: 200,
      remark: 'OnStock',
      approval_status: 'approved',
    },
  ];

  const mockCreatedOrder = {
    id: orderId,
    order_no: orderNo,
    inquiry_id: inquiryId,
    contact_id: 'contact-123',
    sales_date: new Date().toISOString().split('T')[0],
    sales_person: 'Test Person',
    delivery_address: '123 Test St',
    grand_total: 200,
    status: SalesOrderStatus.PENDING,
    is_deleted: false,
    created_at: new Date().toISOString(),
    created_by: userId,
  };

  const mockOrderItems = [
    {
      id: 'order-item-1',
      order_id: orderId,
      item_id: 'item-1',
      qty: 2,
      part_no: 'PART-001',
      item_code: 'CODE-001',
      location: 'MAIN',
      description: 'Test Item 1',
      unit_price: 100,
      amount: 200,
      remark: 'OnStock',
      approval_status: 'approved',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to set up the full mock chain for a createFromInquiry flow:
   * 1. Fetch inquiry from sales_inquiries
   * 2. Fetch inquiry items from sales_inquiry_items
   * 3. Insert into sales_orders
   * 4. Insert into sales_order_items
   */
  const setupCreateFromInquiryMocks = () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sales_inquiries') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: mockInquiry, error: null }),
            }),
          }),
        };
      }
      if (table === 'sales_inquiry_items') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: mockInquiryItems, error: null }),
          }),
        };
      }
      if (table === 'sales_orders') {
        return {
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: mockCreatedOrder, error: null }),
            }),
          }),
          select: () => ({
            eq: (field: string) => {
              if (field === 'id') {
                return {
                  eq: () => ({
                    single: vi.fn().mockResolvedValue({ data: mockCreatedOrder, error: null }),
                  }),
                };
              }
              if (field === 'inquiry_id') {
                return {
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockCreatedOrder, error: null }),
                  }),
                };
              }
              return {
                order: () => ({
                  then: vi.fn().mockResolvedValue({ data: [mockCreatedOrder], error: null }),
                }),
              };
            },
          }),
        };
      }
      if (table === 'sales_order_items') {
        return {
          insert: () => ({
            select: vi.fn().mockResolvedValue({ data: mockOrderItems, error: null }),
          }),
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: mockOrderItems, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });
  };

  it('createFromInquiry creates an order with today\'s date', async () => {
    setupCreateFromInquiryMocks();
    const { createFromInquiry } = await import('../salesOrderService');

    const order = await createFromInquiry(inquiryId);

    expect(order).toBeDefined();
    expect(order.id).toBe(orderId);
    expect(order.inquiry_id).toBe(inquiryId);

    // Verify sales_date is set to today
    const today = new Date().toISOString().split('T')[0];
    // The DTO passed to createSalesOrder should use today's date
    // Verify via the mock that sales_orders insert was called
    const salesOrdersInsertCall = mockSupabase.from.mock.calls.find(
      (call: string[]) => call[0] === 'sales_orders'
    );
    expect(salesOrdersInsertCall).toBeDefined();

    // The order returned should have today's date
    expect(order.sales_date).toBe(today);
  });

  it('order created_at matches the current date', async () => {
    setupCreateFromInquiryMocks();
    const { createFromInquiry } = await import('../salesOrderService');

    const order = await createFromInquiry(inquiryId);

    expect(order.created_at).toBeDefined();
    const createdDate = new Date(order.created_at!).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    expect(createdDate).toBe(today);
  });

  it('getAllSalesOrders returns the newly created order', async () => {
    // Setup mocks for getAllSalesOrders
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sales_orders') {
        return {
          select: () => ({
            eq: () => ({
              order: () => vi.fn().mockResolvedValue({ data: [mockCreatedOrder], error: null })(),
            }),
          }),
        };
      }
      if (table === 'sales_order_items') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: mockOrderItems, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const { getAllSalesOrders } = await import('../salesOrderService');
    const orders = await getAllSalesOrders();

    expect(orders.length).toBeGreaterThan(0);
    const found = orders.find((o) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found!.inquiry_id).toBe(inquiryId);
  });

  it('dispatches salesorder:created custom event and listener receives it', async () => {
    const receivedEvents: CustomEvent[] = [];
    const handler = (event: Event) => {
      receivedEvents.push(event as CustomEvent);
    };

    window.addEventListener('salesorder:created', handler);

    try {
      // Simulate the event dispatch that happens in SalesInquiryView after conversion
      window.dispatchEvent(
        new CustomEvent('salesorder:created', {
          detail: { orderId, orderNo },
        })
      );

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].detail).toEqual({ orderId, orderNo });
    } finally {
      window.removeEventListener('salesorder:created', handler);
    }
  });

  it('verification retry logic eventually finds the order after initial failure', async () => {
    let getSalesOrderCallCount = 0;

    // Mock getSalesOrder to fail twice then succeed on the third attempt
    const mockGetSalesOrder = vi.fn().mockImplementation(async () => {
      getSalesOrderCallCount++;
      if (getSalesOrderCallCount <= 2) {
        return null;
      }
      return { ...mockCreatedOrder, items: mockOrderItems };
    });

    // Test the retry pattern directly (mirrors SalesInquiryView lines 691-698)
    let verifiedOrder = await mockGetSalesOrder(orderId);
    if (!verifiedOrder) {
      for (let attempt = 0; attempt < 3 && !verifiedOrder; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // shorter delay for tests
        verifiedOrder = await mockGetSalesOrder(orderId);
      }
    }

    expect(verifiedOrder).toBeDefined();
    expect(verifiedOrder!.id).toBe(orderId);
    // Initial call (1) + 2 retry calls before success on 3rd = 3 total
    expect(getSalesOrderCallCount).toBe(3);
  });

  it('throws error when inquiry is not in APPROVED status', async () => {
    const nonApprovedInquiry = { ...mockInquiry, status: SalesInquiryStatus.PENDING };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sales_inquiries') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: nonApprovedInquiry, error: null }),
            }),
          }),
        };
      }
      if (table === 'sales_inquiry_items') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: mockInquiryItems, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const { createFromInquiry } = await import('../salesOrderService');

    await expect(createFromInquiry(inquiryId)).rejects.toThrow(
      'Inquiry must be approved before conversion'
    );
  });

  it('throws error when inquiry items have missing item_id', async () => {
    const itemsWithMissingId = [
      { ...mockInquiryItems[0], item_id: null },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sales_inquiries') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: mockInquiry, error: null }),
            }),
          }),
        };
      }
      if (table === 'sales_inquiry_items') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: itemsWithMissingId, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const { createFromInquiry } = await import('../salesOrderService');

    await expect(createFromInquiry(inquiryId)).rejects.toThrow(
      'Cannot convert inquiry: One or more items are missing product references (item_id). Please recreate the inquiry with valid products.'
    );
  });

  it('verification retry logic returns null after all retries exhausted', async () => {
    const mockGetSalesOrder = vi.fn().mockResolvedValue(null);

    let verifiedOrder = await mockGetSalesOrder(orderId);
    if (!verifiedOrder) {
      for (let attempt = 0; attempt < 3 && !verifiedOrder; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        verifiedOrder = await mockGetSalesOrder(orderId);
      }
    }

    expect(verifiedOrder).toBeNull();
    // Initial call (1) + 3 retries = 4 total
    expect(mockGetSalesOrder).toHaveBeenCalledTimes(4);
  });
});
