import { supabase } from '../lib/supabaseClient';
import type { InventoryLog, InventoryLogFilters, InventoryLogWithProduct, PurchaseOrder, StockAdjustment, Invoice, OrderSlip } from '../types';
import { ENTITY_TYPES, logCreate, logDelete, logUpdate } from './activityLogService';

// Helper type for Supabase query results when table is not in generated types
type SupabaseAnyTable = ReturnType<typeof supabase.from>;
const EXPLICIT_DEFAULT_WAREHOUSE_ID =
  (import.meta as any)?.env?.VITE_INVENTORY_LOG_DEFAULT_WAREHOUSE_ID?.trim() || '';

function normalizeWarehouseId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveWarehouseId(
  source: string,
  candidateWarehouseIds: unknown[]
): string {
  for (const candidate of candidateWarehouseIds) {
    const warehouseId = normalizeWarehouseId(candidate);
    if (warehouseId) {
      return warehouseId;
    }
  }

  if (EXPLICIT_DEFAULT_WAREHOUSE_ID) {
    return EXPLICIT_DEFAULT_WAREHOUSE_ID;
  }

  throw new Error(
    `Missing warehouse_id for ${source}. Provide warehouse on the originating record/item or configure VITE_INVENTORY_LOG_DEFAULT_WAREHOUSE_ID.`
  );
}

async function correctLegacyWh1LogsForItem(
  transactionType: string,
  referenceNo: string,
  itemId: string,
  resolvedWarehouseId: string
): Promise<void> {
  if (resolvedWarehouseId === 'WH1') {
    return;
  }

  const { error } = await (supabase as any)
    .from('inventory_logs')
    .update({
      warehouse_id: resolvedWarehouseId,
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_type', transactionType)
    .eq('reference_no', referenceNo)
    .eq('item_id', itemId)
    .eq('warehouse_id', 'WH1')
    .eq('is_deleted', false);

  if (error) {
    console.error('Failed correcting legacy WH1 inventory logs:', error);
  }
}

type LegacyWh1InventoryLog = Pick<InventoryLog, 'id' | 'item_id' | 'reference_no' | 'transaction_type' | 'warehouse_id'>;

function parseReturnIdFromReference(referenceNo: string): string | null {
  const match = /^RET-(.+)$/.exec(referenceNo);
  return match?.[1] || null;
}

async function resolveBackfillWarehouseId(log: LegacyWh1InventoryLog): Promise<string | null> {
  if (log.transaction_type === 'Invoice') {
    const { data: invoice } = await (supabase as any)
      .from('invoices')
      .select(`
        id,
        invoice_no,
        warehouse_id,
        invoice_items (
          item_id,
          warehouse_id,
          location
        )
      `)
      .eq('invoice_no', log.reference_no)
      .single();

    if (!invoice) {
      return null;
    }

    const invoiceItem = (invoice.invoice_items || []).find((item: any) => item.item_id === log.item_id);
    return resolveWarehouseId(`invoice ${invoice.invoice_no || invoice.id} item ${log.item_id}`, [
      invoiceItem?.warehouse_id,
      invoiceItem?.location,
      invoice.warehouse_id,
      invoice.warehouseId,
    ]);
  }

  if (log.transaction_type === 'Order Slip') {
    const { data: slip } = await (supabase as any)
      .from('order_slips')
      .select(`
        id,
        slip_no,
        warehouse_id,
        order_slip_items (
          item_id,
          warehouse_id,
          location
        )
      `)
      .eq('slip_no', log.reference_no)
      .single();

    if (!slip) {
      return null;
    }

    const slipItem = (slip.order_slip_items || []).find((item: any) => item.item_id === log.item_id);
    return resolveWarehouseId(`order slip ${slip.slip_no || slip.id}`, [
      slip.warehouse_id,
      slip.warehouseId,
      slipItem?.warehouse_id,
      slipItem?.location,
    ]);
  }

  if (log.transaction_type === 'Credit Memo') {
    const returnId = parseReturnIdFromReference(log.reference_no);
    if (!returnId) {
      return null;
    }

    const { data: returnRecord } = await (supabase as any)
      .from('sales_returns')
      .select('id, return_no, warehouse_id, products')
      .eq('id', returnId)
      .single();

    if (!returnRecord) {
      return null;
    }

    const matchedProduct = ((returnRecord.products || []) as any[]).find((product: any) =>
      product.id === log.item_id ||
      product.item_id === log.item_id ||
      product.product_id === log.item_id
    );

    return resolveWarehouseId(`sales return ${returnRecord.return_no || returnRecord.id} item ${log.item_id}`, [
      matchedProduct?.original_warehouse_id,
      matchedProduct?.warehouse_id,
      matchedProduct?.return_warehouse_id,
      returnRecord.warehouse_id,
    ]);
  }

  return null;
}

/**
 * Backfill legacy inventory logs that were incorrectly posted to WH1.
 * Returns number of corrected rows.
 */
export async function backfillLegacyWh1InventoryLogs(limit = 500): Promise<number> {
  const { data: candidateLogs, error } = await (supabase as any)
    .from('inventory_logs')
    .select('id, item_id, reference_no, transaction_type, warehouse_id')
    .eq('is_deleted', false)
    .eq('warehouse_id', 'WH1')
    .in('transaction_type', ['Invoice', 'Order Slip', 'Credit Memo'])
    .limit(limit);

  if (error) {
    console.error('Failed fetching candidate WH1 inventory logs:', error);
    throw error;
  }

  let correctedCount = 0;
  for (const log of (candidateLogs || []) as LegacyWh1InventoryLog[]) {
    try {
      const resolvedWarehouseId = await resolveBackfillWarehouseId(log);
      if (!resolvedWarehouseId || resolvedWarehouseId === 'WH1') {
        continue;
      }

      const { error: updateError } = await (supabase as any)
        .from('inventory_logs')
        .update({
          warehouse_id: resolvedWarehouseId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', log.id);

      if (updateError) {
        console.error(`Failed correcting inventory log ${log.id}:`, updateError);
        continue;
      }

      correctedCount += 1;
    } catch (resolveError) {
      console.error(`Failed resolving warehouse for inventory log ${log.id}:`, resolveError);
    }
  }

  return correctedCount;
}

/**
 * Fetch inventory logs with optional filters
 */
export async function fetchInventoryLogs(filters?: InventoryLogFilters): Promise<InventoryLog[]> {
  let query = (supabase as any)
    .from('inventory_logs')
    .select(`
      *,
      products (
        id,
        item_code,
        part_no,
        brand,
        description,
        stock_wh1,
        stock_wh2,
        stock_wh3,
        stock_wh4,
        stock_wh5,
        stock_wh6
      )
    `)
    .eq('is_deleted', false)
    .order('date', { ascending: true });

  if (filters?.item_id) {
    query = query.eq('item_id', filters.item_id);
  }

  if (filters?.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id);
  }

  if (filters?.date_from) {
    query = query.gte('date', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('date', filters.date_to);
  }

  if (filters?.transaction_type) {
    query = query.eq('transaction_type', filters.transaction_type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inventory logs:', error);
    throw error;
  }

  return (data as InventoryLog[]) || [];
}

/**
 * Create a new inventory log entry
 */
export async function createInventoryLog(
  data: Omit<InventoryLog, 'id' | 'created_at' | 'updated_at' | 'processed_by'>
): Promise<InventoryLog> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data: newLog, error } = await (supabase as any)
    .from('inventory_logs')
    .insert({
      ...data,
      processed_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating inventory log:', error);
    throw error;
  }

  try {
    await logCreate(ENTITY_TYPES.INVENTORY_LOG, newLog.id, {
      transaction_type: newLog.transaction_type,
      reference_no: newLog.reference_no,
      qty_in: newLog.qty_in,
      qty_out: newLog.qty_out,
    });
  } catch (logError) {
    console.error('Failed to log activity:', logError);
  }

  return newLog as InventoryLog;
}

/**
 * Update an existing inventory log
 */
export async function updateInventoryLog(
  id: string,
  updates: Partial<InventoryLog>
): Promise<InventoryLog | null> {
  const { data, error } = await (supabase as any)
    .from('inventory_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating inventory log:', error);
    throw error;
  }

  try {
    await logUpdate(ENTITY_TYPES.INVENTORY_LOG, id, {
      updated_fields: Object.keys(updates),
    });
  } catch (logError) {
    console.error('Failed to log activity:', logError);
  }

  return data as InventoryLog;
}

/**
 * Soft delete an inventory log (set is_deleted = true)
 */
export async function deleteInventoryLog(id: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from('inventory_logs')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error deleting inventory log:', error);
    throw error;
  }

  try {
    await logDelete(ENTITY_TYPES.INVENTORY_LOG, id, { reason: 'soft_delete' });
  } catch (logError) {
    console.error('Failed to log activity:', logError);
  }

  return true;
}

/**
 * Get inventory logs for a specific item
 */
export async function getInventoryLogsByItem(
  itemId: string,
  warehouseId?: string
): Promise<InventoryLog[]> {
  let query = (supabase as any)
    .from('inventory_logs')
    .select(`
      *,
      products (
        id,
        item_code,
        part_no,
        brand,
        description,
        stock_wh1,
        stock_wh2,
        stock_wh3,
        stock_wh4,
        stock_wh5,
        stock_wh6
      )
    `)
    .eq('item_id', itemId)
    .eq('is_deleted', false)
    .order('date', { ascending: true });

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inventory logs by item:', error);
    throw error;
  }

  return (data as InventoryLog[]) || [];
}

/**
 * Create inventory logs from a Purchase Order
 */
export async function createInventoryLogFromPO(poId: string, userId: string): Promise<InventoryLog[]> {
  // Fetch PO and items
  const { data: po, error: poError } = await (supabase as any)
    .from('purchase_orders')
    .select(`
      *,
      purchase_order_items (*)
    `)
    .eq('id', poId)
    .single();

  if (poError || !po) {
    throw new Error('Purchase Order not found');
  }

  // Validate PO status is 'delivered'
  if (po.status !== 'delivered') {
    throw new Error('Purchase Order must be delivered to create inventory logs');
  }

  // Fetch supplier details
  const { data: supplier, error: supplierError } = await supabase
    .from('contacts')
    .select('company')
    .eq('id', po.supplier_id)
    .single();

  const supplierName = supplier?.company || 'Unknown Supplier';

  // Create inventory log for each item
  const logs: InventoryLog[] = [];
  for (const item of po.purchase_order_items || []) {
    const log = await createInventoryLog({
      item_id: item.item_id,
      date: po.delivery_date || po.order_date,
      transaction_type: 'Purchase Order',
      reference_no: po.po_no,
      partner: supplierName,
      warehouse_id: po.warehouse_id,
      qty_in: item.qty,
      qty_out: 0,
      status_indicator: '+',
      unit_price: item.unit_price,
      notes: item.notes,
    });
    logs.push(log);
  }

  return logs;
}

/**
 * Create inventory logs from an Invoice
 */
export async function createInventoryLogFromInvoice(invoiceId: string, userId: string): Promise<InventoryLog[]> {
  // Fetch invoice and items
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items (*)
    `)
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error('Invoice not found');
  }

  // Validate invoice status is 'sent' or 'paid'
  if (invoice.status !== 'sent' && invoice.status !== 'paid') {
    throw new Error('Invoice must be sent or paid to create inventory logs');
  }

  // Fetch customer details
  const { data: customer, error: customerError } = await supabase
    .from('contacts')
    .select('company')
    .eq('id', invoice.contact_id)
    .single();

  const customerName = customer?.company || 'Unknown Customer';

  // Create inventory log for each item
  const logs: InventoryLog[] = [];
  const invoiceItems = (invoice as any).invoice_items || [];
  for (const item of invoiceItems) {
    const warehouseId = resolveWarehouseId(`invoice ${invoice.invoice_no || invoice.id} item ${item.item_id || item.id || 'unknown'}`, [
      item.warehouse_id,
      item.warehouseId,
      item.original_warehouse_id,
      item.return_warehouse_id,
      item.location,
      invoice.warehouse_id,
      invoice.warehouseId,
    ]);

    const log = await createInventoryLog({
      item_id: item.item_id,
      date: invoice.sales_date,
      transaction_type: 'Invoice',
      reference_no: invoice.invoice_no,
      partner: customerName,
      warehouse_id: warehouseId,
      qty_in: 0,
      qty_out: item.qty,
      status_indicator: '-',
      unit_price: item.unit_price,
    });
    await correctLegacyWh1LogsForItem('Invoice', invoice.invoice_no, item.item_id, warehouseId);
    logs.push(log);
  }

  return logs;
}

/**
 * Create inventory logs from an Order Slip
 */
export async function createInventoryLogFromOrderSlip(slipOrId: string | OrderSlip, userId: string): Promise<InventoryLog[]> {
  let slip: any; // Using any to handle both OrderSlip type and database response shape

  if (typeof slipOrId === 'string') {
    // Fetch order slip and items if ID is passed
    const { data, error } = await supabase
      .from('order_slips')
      .select(`
        *,
        order_slip_items (*)
      `)
      .eq('id', slipOrId)
      .single();

    if (error || !data) {
      throw new Error('Order Slip not found');
    }
    slip = data;
  } else {
    // Use passed object
    slip = slipOrId;
  }

  // Validate slip status is 'finalized'
  // Note: If passed directly from finalize function, trust the caller or ensure caller sets status first
  if (slip.status !== 'finalized') {
    throw new Error('Order Slip must be finalized to create inventory logs');
  }

  // Fetch customer details
  const { data: customer, error: customerError } = await supabase
    .from('contacts')
    .select('company')
    .eq('id', slip.contact_id)
    .single();

  const customerName = customer?.company || 'Unknown Customer';

  // Determine items array (might be 'items' or 'order_slip_items' depending on source)
  const items = slip.order_slip_items || slip.items || [];

  // Create inventory log for each item
  const logs: InventoryLog[] = [];
  for (const item of items) {
    const warehouseId = resolveWarehouseId(`order slip ${slip.slip_no || slip.id}`, [
      slip.warehouse_id,
      slip.warehouseId,
      item.warehouse_id,
      item.warehouseId,
      item.location,
    ]);

    const log = await createInventoryLog({
      item_id: item.item_id,
      date: slip.sales_date,
      transaction_type: 'Order Slip',
      reference_no: slip.slip_no,
      partner: customerName,
      warehouse_id: warehouseId,
      qty_in: 0,
      qty_out: item.qty,
      status_indicator: '-',
      unit_price: item.unit_price,
    });
    await correctLegacyWh1LogsForItem('Order Slip', slip.slip_no, item.item_id, warehouseId);
    logs.push(log);
  }

  return logs;
}

/**
 * Create inventory logs from a Stock Adjustment
 */
export async function createInventoryLogFromStockAdjustment(adjustmentId: string, userId: string): Promise<InventoryLog[]> {
  // Fetch adjustment and items
  const { data: adjustment, error: adjustmentError } = await (supabase as any)
    .from('stock_adjustments')
    .select(`
      *,
      stock_adjustment_items (*)
    `)
    .eq('id', adjustmentId)
    .single();

  if (adjustmentError || !adjustment) {
    throw new Error('Stock Adjustment not found');
  }

  // Validate status is 'finalized'
  if (adjustment.status !== 'finalized') {
    throw new Error('Stock Adjustment must be finalized to create inventory logs');
  }

  // Create inventory log for each item with difference
  const logs: InventoryLog[] = [];
  for (const item of adjustment.stock_adjustment_items || []) {
    if (item.difference === 0) continue; // Skip items with no difference

    const qtyIn = item.difference > 0 ? item.difference : 0;
    const qtyOut = item.difference < 0 ? Math.abs(item.difference) : 0;
    const statusIndicator = item.difference > 0 ? '+' : '-';

    const log = await createInventoryLog({
      item_id: item.item_id,
      date: adjustment.adjustment_date,
      transaction_type: 'Stock Adjustment',
      reference_no: adjustment.adjustment_no,
      partner: 'Internal',
      warehouse_id: adjustment.warehouse_id,
      qty_in: qtyIn,
      qty_out: qtyOut,
      status_indicator: statusIndicator as '+' | '-',
      unit_price: 0, // Stock adjustments don't have unit prices
      notes: item.reason || `${adjustment.adjustment_type}: ${adjustment.notes || ''}`,
    });
    logs.push(log);
  }

  return logs;
}

/**
 * Create inventory logs from a Sales Return
 */
export async function createInventoryLogFromReturn(returnId: string, userId: string): Promise<InventoryLog[]> {
  // Fetch return record
  const { data: returnRecord, error: returnError } = await supabase
    .from('sales_returns')
    .select('*')
    .eq('id', returnId)
    .single();

  if (returnError || !returnRecord) {
    throw new Error('Sales Return not found');
  }

  // Validate status is 'processed'
  if (returnRecord.status !== 'processed') {
    throw new Error('Sales Return must be processed to create inventory logs');
  }

  // Fetch customer details
  const { data: customer, error: customerError } = await supabase
    .from('contacts')
    .select('company')
    .eq('id', returnRecord.contact_id)
    .single();

  const customerName = customer?.company || 'Unknown Customer';

  // Parse products JSONB and create log entries
  const products = returnRecord.products as Array<{
    name: string;
    quantity: number;
    originalPrice: number;
    refundAmount: number;
  }>;

  const logs: InventoryLog[] = [];
  for (const product of products) {
    // Find product ID by name (this assumes products have unique names)
    const { data: productData } = await supabase
      .from('products')
      .select('id')
      .eq('description', product.name)
      .single();

    if (productData) {
      const warehouseId = resolveWarehouseId(`sales return ${returnRecord.return_no || returnRecord.id} item ${productData.id}`, [
        (product as any).original_warehouse_id,
        (product as any).warehouse_id,
        (product as any).return_warehouse_id,
        returnRecord.warehouse_id,
        returnRecord.original_warehouse_id,
      ]);

      const log = await createInventoryLog({
        item_id: productData.id,
        date: returnRecord.return_date, // Fixed: using correct column name
        transaction_type: 'Credit Memo',
        reference_no: `RET-${returnId}`,
        partner: customerName,
        warehouse_id: warehouseId,
        qty_in: product.quantity,
        qty_out: 0,
        status_indicator: '+',
        unit_price: product.originalPrice,
        notes: returnRecord.reason,
      });
      await correctLegacyWh1LogsForItem('Credit Memo', `RET-${returnId}`, productData.id, warehouseId);
      logs.push(log);
    }
  }

  return logs;
}
