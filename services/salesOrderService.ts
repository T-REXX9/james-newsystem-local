import { supabase } from '../lib/supabaseClient';
import {
  Invoice,
  OrderSlip,
  RecycleBinItemType,
  SalesInquiryStatus,
  SalesOrder,
  SalesOrderDTO,
  SalesOrderItem,
  SalesOrderStatus,
} from '../types';
import { createFromOrder as createOrderSlipFromOrder } from './orderSlipService';
import { createFromOrder as createInvoiceFromOrder } from './invoiceService';
import { sanitizeArray, sanitizeObject, SanitizationConfig } from '../utils/dataSanitization';
import { parseSupabaseError } from '../utils/errorHandler';
import {
  ENTITY_TYPES,
  logActivity,
  logCreate,
  logDelete,
  logRestore,
  logStatusChange,
  logUpdate,
} from './activityLogService';

const formatSequence = (): string => String(Math.floor(Math.random() * 100000)).padStart(5, '0');

const salesOrderSanitizationConfig: SanitizationConfig<SalesOrderDTO> = {
  sales_date: { type: 'string', placeholder: 'n/a', required: true },
  sales_person: { type: 'string', placeholder: 'n/a' },
  delivery_address: { type: 'string', placeholder: 'n/a' },
  reference_no: { type: 'string', placeholder: 'n/a' },
  customer_reference: { type: 'string', placeholder: 'n/a' },
  send_by: { type: 'string', placeholder: 'n/a' },
  price_group: { type: 'string', placeholder: 'n/a' },
  credit_limit: { type: 'number', placeholder: 0 },
  terms: { type: 'string', placeholder: 'n/a' },
  promise_to_pay: { type: 'string', placeholder: 'n/a' },
  po_number: { type: 'string', placeholder: 'n/a' },
  remarks: { type: 'string', placeholder: 'n/a' },
  inquiry_type: { type: 'string', placeholder: 'n/a' },
  urgency: { type: 'string', placeholder: 'n/a' },
  urgency_date: { type: 'date', placeholder: null },
};

const salesOrderItemSanitizationConfig: SanitizationConfig<
  Omit<SalesOrderItem, 'id' | 'order_id'>
> = {
  item_id: { type: 'string', placeholder: 'n/a', required: true },
  part_no: { type: 'string', placeholder: 'n/a' },
  item_code: { type: 'string', placeholder: 'n/a' },
  location: { type: 'string', placeholder: 'n/a' },
  description: { type: 'string', placeholder: 'n/a' },
  qty: { type: 'number', placeholder: 0 },
  unit_price: { type: 'number', placeholder: 0 },
  amount: { type: 'number', placeholder: 0 },
  remark: { type: 'string', placeholder: 'n/a' },
};

export const ORDER_SLIP_TRANSACTION_TYPES = ['Order Slip', 'PO'];
export const INVOICE_TRANSACTION_TYPES = ['Invoice', 'Sales Invoice'];

export const isOrderSlipAllowedForTransactionType = (transactionType?: string | null): boolean => {
  if (!transactionType) return true;
  return !INVOICE_TRANSACTION_TYPES.includes(transactionType);
};

export const isInvoiceAllowedForTransactionType = (transactionType?: string | null): boolean => {
  if (!transactionType) return true;
  return !ORDER_SLIP_TRANSACTION_TYPES.includes(transactionType);
};

export const getDocumentTypeForTransaction = (
  transactionType?: string | null
): 'orderslip' | 'invoice' | null => {
  if (!transactionType) return null;
  if (ORDER_SLIP_TRANSACTION_TYPES.includes(transactionType)) return 'orderslip';
  if (INVOICE_TRANSACTION_TYPES.includes(transactionType)) return 'invoice';
  return null;
};

export const DOCUMENT_POLICY_STORAGE_KEY = 'document:selectedTransactionType';

export const readDocumentPolicyFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DOCUMENT_POLICY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to read document policy state:', err);
    return null;
  }
};

export const syncDocumentPolicyState = (transactionType?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (transactionType) {
      window.sessionStorage.setItem(DOCUMENT_POLICY_STORAGE_KEY, transactionType);
    } else {
      window.sessionStorage.removeItem(DOCUMENT_POLICY_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to persist document policy state:', err);
  }

  try {
    window.dispatchEvent(
      new CustomEvent('documentPolicy:update', {
        detail: { transactionType: transactionType || null },
      })
    );
  } catch (err) {
    console.error('Failed to dispatch document policy event:', err);
  }
};

export const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `ORD-${dateStr}-${formatSequence()}`;
};

const mapOrderItemPayload = (item: Omit<SalesOrderItem, 'id' | 'order_id'>, orderId: string) => ({
  order_id: orderId,
  item_id: item.item_id,
  qty: item.qty,
  part_no: item.part_no,
  item_code: item.item_code,
  location: item.location,
  description: item.description,
  unit_price: item.unit_price,
  amount: item.amount,
  remark: item.remark,
  approval_status: item.approval_status || 'pending',
});

const fetchOrderItems = async (orderId: string): Promise<SalesOrderItem[]> => {
  const { data } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('order_id', orderId);

  return (data as SalesOrderItem[]) || [];
};

const attachOrderItems = async (order: any): Promise<SalesOrder> => {
  const items = await fetchOrderItems(order.id);
  return {
    ...order,
    items,
  } as SalesOrder;
};

const fetchInquiry = async (inquiryId: string) => {
  const { data, error } = await supabase
    .from('sales_inquiries')
    .select('*')
    .eq('id', inquiryId)
    .single();

  if (error || !data) {
    throw new Error('Sales inquiry not found');
  }

  const { data: items } = await supabase
    .from('sales_inquiry_items')
    .select('*')
    .eq('inquiry_id', inquiryId);

  return { inquiry: data, items: items || [] };
};

export const createSalesOrder = async (data: SalesOrderDTO): Promise<SalesOrder> => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    if (!data.items || data.items.length === 0) {
      throw new Error('Please add at least one line item before saving the order.');
    }

    const sanitizedData = sanitizeObject(data, salesOrderSanitizationConfig);
    const sanitizedItems = sanitizeArray(
      sanitizedData.items,
      (item) => sanitizeObject(item as Omit<SalesOrderItem, 'id' | 'order_id'>, salesOrderItemSanitizationConfig)
    );
    const orderNo = generateOrderNumber();
    const status = data.status || SalesOrderStatus.PENDING;
    const grandTotal = sanitizedItems.reduce((sum, item) => sum + (item.amount || 0), 0);

    const payload = {
      order_no: orderNo,
      inquiry_id: sanitizedData.inquiry_id || null,
      contact_id: sanitizedData.contact_id,
      sales_date: sanitizedData.sales_date,
      sales_person: sanitizedData.sales_person,
      delivery_address: sanitizedData.delivery_address,
      reference_no: sanitizedData.reference_no,
      customer_reference: sanitizedData.customer_reference,
      send_by: sanitizedData.send_by,
      price_group: sanitizedData.price_group,
      credit_limit: sanitizedData.credit_limit,
      terms: sanitizedData.terms,
      promise_to_pay: sanitizedData.promise_to_pay,
      po_number: sanitizedData.po_number,
      remarks: sanitizedData.remarks,
      inquiry_type: sanitizedData.inquiry_type,
      urgency: sanitizedData.urgency,
      urgency_date: sanitizedData.urgency_date,
      grand_total: grandTotal,
      status,
      approved_by: sanitizedData.approved_by || null,
      approved_at: sanitizedData.approved_at || null,
      created_by: user.id,
    };

    const { data: order, error } = await supabase
      .from('sales_orders')
      .insert(payload)
      .select()
      .single();

    if (error || !order) throw error || new Error('Failed to create order');

    const { data: itemRows, error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(sanitizedItems.map(item => mapOrderItemPayload(item, order.id)))
      .select();

    if (itemsError) throw itemsError;

    try {
      await logCreate(ENTITY_TYPES.SALES_ORDER, order.id, {
        order_no: order.order_no || orderNo,
        contact_id: order.contact_id || sanitizedData.contact_id,
        grand_total: order.grand_total || grandTotal,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    return {
      ...order,
      items: (itemRows as SalesOrderItem[]) || [],
    } as SalesOrder;
  } catch (err) {
    console.error('Error creating sales order:', err);
    throw new Error(parseSupabaseError(err, 'sales order'));
  }
};

export const createFromInquiry = async (inquiryId: string): Promise<SalesOrder> => {
  try {
    const { inquiry, items } = await fetchInquiry(inquiryId);

    if (inquiry.status !== SalesInquiryStatus.APPROVED) {
      throw new Error('Inquiry must be approved before conversion');
    }

    // Validate that all items have an item_id (product reference)
    // This is crucial for inventory log tracking
    const missingItemIds = items.some((item: any) => !item.item_id);
    if (missingItemIds) {
      throw new Error('Cannot convert inquiry: One or more items are missing product references (item_id). Please recreate the inquiry with valid products.');
    }

    const dto: SalesOrderDTO = {
      inquiry_id: inquiry.id,
      contact_id: inquiry.contact_id,
      sales_date: inquiry.sales_date,
      sales_person: inquiry.sales_person,
      delivery_address: inquiry.delivery_address,
      reference_no: inquiry.reference_no,
      customer_reference: inquiry.customer_reference,
      send_by: inquiry.send_by,
      price_group: inquiry.price_group,
      credit_limit: inquiry.credit_limit,
      terms: inquiry.terms,
      promise_to_pay: inquiry.promise_to_pay,
      po_number: inquiry.po_number,
      remarks: inquiry.remarks,
      inquiry_type: inquiry.inquiry_type,
      urgency: inquiry.urgency,
      urgency_date: inquiry.urgency_date,
      items: items.map((item: any) => ({
        item_id: item.item_id,
        qty: item.qty,
        part_no: item.part_no,
        item_code: item.item_code,
        location: item.location,
        description: item.description,
        unit_price: item.unit_price,
        amount: item.amount,
        remark: item.remark,
        approval_status: item.approval_status,
      })),
    };

    return createSalesOrder(dto);
  } catch (err) {
    console.error('Error creating sales order from inquiry:', err);
    throw err;
  }
};

export const getSalesOrder = async (id: string): Promise<SalesOrder | null> => {
  try {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return null;
    return attachOrderItems(data);
  } catch (err) {
    console.error('Error fetching sales order:', err);
    return null;
  }
};

export const getSalesOrdersByCustomer = async (customerId: string): Promise<SalesOrder[]> => {
  try {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('contact_id', customerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return Promise.all(data.map(order => attachOrderItems(order)));
  } catch (err) {
    console.error('Error fetching sales orders by customer:', err);
    return [];
  }
};

export const getSalesOrderByInquiry = async (inquiryId: string): Promise<SalesOrder | null> => {
  try {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !data) return null;
    return attachOrderItems(data);
  } catch (err) {
    console.error('Error fetching sales order by inquiry:', err);
    return null;
  }
};

export const updateSalesOrder = async (
  id: string,
  data: Partial<SalesOrderDTO>
): Promise<SalesOrder | null> => {
  try {
    const sanitizedData = sanitizeObject(
      data as SalesOrderDTO,
      salesOrderSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    const sanitizedItems = sanitizedData.items
      ? sanitizeArray(
          sanitizedData.items,
          (item) => sanitizeObject(item as Omit<SalesOrderItem, 'id' | 'order_id'>, salesOrderItemSanitizationConfig)
        )
      : null;
    const updatePayload: Record<string, any> = {};
    const fields = [
      'sales_date',
      'sales_person',
      'delivery_address',
      'reference_no',
      'customer_reference',
      'send_by',
      'price_group',
      'credit_limit',
      'terms',
      'promise_to_pay',
      'po_number',
      'remarks',
      'inquiry_type',
      'urgency',
      'urgency_date',
      'status',
      'approved_by',
      'approved_at',
    ];

    fields.forEach(field => {
      if (field in sanitizedData) {
        updatePayload[field] = (sanitizedData as any)[field];
      }
    });

    if (sanitizedItems) {
      updatePayload.grand_total = sanitizedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    if (Object.keys(updatePayload).length) {
      const { error } = await supabase
        .from('sales_orders')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    }

    if (sanitizedItems) {
      await supabase.from('sales_order_items').delete().eq('order_id', id);
      await supabase
        .from('sales_order_items')
        .insert(sanitizedItems.map(item => mapOrderItemPayload(item, id)));
    }

    try {
      const updatedFields = [
        ...Object.keys(updatePayload),
        ...(sanitizedItems ? ['items'] : []),
      ];
      await logUpdate(ENTITY_TYPES.SALES_ORDER, id, { updated_fields: updatedFields });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    return getSalesOrder(id);
  } catch (err) {
    console.error('Error updating sales order:', err);
    throw new Error(parseSupabaseError(err, 'sales order'));
  }
};

export const confirmSalesOrder = async (id: string): Promise<SalesOrder | null> => {
  try {
    const order = await getSalesOrder(id);
    if (!order) throw new Error('Order not found');
    if (order.status !== SalesOrderStatus.PENDING) {
      throw new Error('Order must be pending before confirmation');
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    await supabase
      .from('sales_orders')
      .update({
        status: SalesOrderStatus.CONFIRMED,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    try {
      await logStatusChange(
        ENTITY_TYPES.SALES_ORDER,
        id,
        SalesOrderStatus.PENDING,
        SalesOrderStatus.CONFIRMED
      );
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    return getSalesOrder(id);
  } catch (err) {
    console.error('Error confirming sales order:', err);
    throw err;
  }
};

export const deleteSalesOrder = async (id: string): Promise<boolean> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the order data before deletion
    const order = await getSalesOrder(id);
    if (!order) throw new Error('Order not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.ORDER,
        item_id: id,
        original_data: order as any,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        restore_token: `restore_${id}_${Date.now()}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        permanent_delete_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the order
    const { error } = await supabase
      .from('sales_orders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    try {
      await logDelete(ENTITY_TYPES.SALES_ORDER, id, {
        order_no: order.order_no,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
    return true;
  } catch (err) {
    console.error('Error deleting sales order:', err);
    return false;
  }
};

export const restoreSalesOrder = async (id: string): Promise<SalesOrder | null> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.ORDER);

    // Restore the order
    const { error } = await supabase
      .from('sales_orders')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    const restored = await getSalesOrder(id);
    if (restored) {
      try {
        await logRestore(ENTITY_TYPES.SALES_ORDER, id, {
          order_no: restored.order_no,
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }
    return restored;
  } catch (err) {
    console.error('Error restoring sales order:', err);
    return null;
  }
};

export const getAllSalesOrders = async (
  filters: { status?: SalesOrderStatus; contactId?: string } = {}
): Promise<SalesOrder[]> => {
  try {
    let query = supabase
      .from('sales_orders')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return Promise.all(data.map(order => attachOrderItems(order)));
  } catch (err) {
    console.error('Error fetching all sales orders:', err);
    return [];
  }
};

const fetchContactTransactionType = async (contactId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('contacts')
    .select('transactionType')
    .eq('id', contactId)
    .single();

  return data?.transactionType || null;
};

export const convertToDocument = async (orderId: string): Promise<OrderSlip | Invoice | null> => {
  const order = await getSalesOrder(orderId);
  if (!order) throw new Error('Order not found');

  if (order.status !== SalesOrderStatus.CONFIRMED) {
    throw new Error('Only confirmed orders can be converted');
  }

  const transactionType = await fetchContactTransactionType(order.contact_id);
  // Default to Invoice if transaction type not found (fallback)
  const typeToUse = transactionType || 'Invoice';

  if (!typeToUse) {
    // Should be unreachable due to fallback, but keeping for type safety/completeness if logic changes
    throw new Error('Unable to determine customer transaction type');
  }

  let document: OrderSlip | Invoice | null = null;

  if (ORDER_SLIP_TRANSACTION_TYPES.includes(typeToUse)) {
    document = await createOrderSlipFromOrder(orderId);
  } else if (INVOICE_TRANSACTION_TYPES.includes(typeToUse)) {
    document = await createInvoiceFromOrder(orderId);
  } else {
    throw new Error(`Unsupported transaction type: ${typeToUse}`);
  }

  await supabase
    .from('sales_orders')
    .update({ status: SalesOrderStatus.CONVERTED_TO_DOCUMENT })
    .eq('id', orderId);

  try {
    await logActivity('CONVERT_TO_DOCUMENT', ENTITY_TYPES.SALES_ORDER, orderId, {
      document_type: typeToUse,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  return document;
};
