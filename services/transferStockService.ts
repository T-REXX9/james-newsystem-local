import { supabase } from '../lib/supabaseClient';
import type { TransferStock, TransferStockDTO, TransferStockItem } from '../types';
import { ENTITY_TYPES, logDelete, logStatusChange, logUpdate, logCreate } from './activityLogService';

/**
 * Generate next transfer number
 */
export async function generateTransferNo(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_transfer_no');

  if (error) {
    console.error('Error generating transfer number:', error);
    throw error;
  }

  return data as string;
}

/**
 * Create a new Transfer Stock Request
 */
export async function createTransferStock(data: TransferStockDTO): Promise<TransferStock> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Create the transfer request
  const { data: transfer, error: transferError } = await supabase
    .from('branch_inventory_transfers')
    .insert({
      transfer_no: data.transfer_no,
      transfer_date: data.transfer_date,
      notes: data.notes,
      status: 'pending',
      processed_by: user.id,
      is_deleted: false,
    })
    .select()
    .single();

  if (transferError || !transfer) {
    console.error('Error creating transfer stock:', transferError);
    throw transferError || new Error('Failed to create transfer stock');
  }

  // Create transfer items
  const itemsToInsert = data.items.map(item => ({
    transfer_id: transfer.id,
    item_id: item.item_id,
    from_warehouse_id: item.from_warehouse_id,
    to_warehouse_id: item.to_warehouse_id,
    transfer_qty: item.transfer_qty,
    notes: item.notes,
  }));

  const { error: itemsError } = await supabase
    .from('branch_inventory_transfer_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('Error creating transfer items:', itemsError);
    // Rollback: delete the transfer
    await supabase.from('branch_inventory_transfers').delete().eq('id', transfer.id);
    throw itemsError;
  }

  try {
    await logCreate(ENTITY_TYPES.TRANSFER_STOCK, transfer.id, {
      transfer_no: transfer.transfer_no,
      transfer_date: transfer.transfer_date,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  // Fetch the complete transfer with items
  return await getTransferStock(transfer.id) as TransferStock;
}

/**
 * Get a Transfer Stock by ID
 */
export async function getTransferStock(id: string): Promise<TransferStock | null> {
  const { data, error } = await supabase
    .from('branch_inventory_transfers')
    .select(`
      *,
      branch_inventory_transfer_items (*)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching transfer stock:', error);
    return null;
  }

  // Map items to match TransferStockItem interface
  const transfer = {
    ...data,
    items: data.branch_inventory_transfer_items as TransferStockItem[]
  };

  return transfer as TransferStock;
}

/**
 * Get all Transfer Stocks with optional filters
 */
export async function fetchTransferStocks(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<TransferStock[]> {
  let query = supabase
    .from('branch_inventory_transfers')
    .select(`
      *,
      branch_inventory_transfer_items (*)
    `)
    .eq('is_deleted', false)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('transfer_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('transfer_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transfer stocks:', error);
    throw error;
  }

  // Map items to match TransferStockItem interface
  return (data || []).map(transfer => ({
    ...transfer,
    items: transfer.branch_inventory_transfer_items as TransferStockItem[]
  })) as TransferStock[];
}

/**
 * Update a Transfer Stock
 */
export async function updateTransferStock(
  id: string,
  updates: Partial<Pick<TransferStock, 'transfer_date' | 'notes' | 'status'>>
): Promise<TransferStock | null> {
  // Check if transfer exists
  const existingTransfer = await getTransferStock(id);
  if (!existingTransfer) {
    throw new Error('Transfer Stock not found');
  }

  // Only allow updating if status is 'pending'
  if (existingTransfer.status !== 'pending' && updates.status !== 'deleted') {
    throw new Error('Only pending transfer stocks can be updated');
  }

  const { data, error } = await supabase
    .from('branch_inventory_transfers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transfer stock:', error);
    throw error;
  }

  try {
    await logUpdate(ENTITY_TYPES.TRANSFER_STOCK, id, {
      updated_fields: Object.keys(updates),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  return await getTransferStock(id);
}

/**
 * Submit a Transfer Stock for approval
 */
export async function submitTransferStock(id: string): Promise<TransferStock | null> {
  // Check if transfer exists
  const existingTransfer = await getTransferStock(id);
  if (!existingTransfer) {
    throw new Error('Transfer Stock not found');
  }

  // Only allow submitting if status is 'pending'
  if (existingTransfer.status !== 'pending') {
    throw new Error('Only pending transfer stocks can be submitted');
  }

  // Validate that transfer has items
  if (!existingTransfer.items || existingTransfer.items.length === 0) {
    throw new Error('Transfer must have at least one item');
  }

  const { data, error } = await supabase
    .from('branch_inventory_transfers')
    .update({ status: 'submitted' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error submitting transfer stock:', error);
    throw error;
  }

  try {
    await logStatusChange(ENTITY_TYPES.TRANSFER_STOCK, id, 'pending', 'submitted');
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  return await getTransferStock(id);
}

/**
 * Approve a Transfer Stock
 * This triggers inventory log creation and stock updates
 */
export async function approveTransferStock(id: string): Promise<TransferStock | null> {
  // Check if transfer exists
  const existingTransfer = await getTransferStock(id);
  if (!existingTransfer) {
    throw new Error('Transfer Stock not found');
  }

  // Only allow approving if status is 'submitted'
  if (existingTransfer.status !== 'submitted') {
    throw new Error('Only submitted transfer stocks can be approved');
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Update status to 'approved'
  // The database trigger will handle stock validation and inventory log creation
  const { data, error } = await supabase
    .from('branch_inventory_transfers')
    .update({ status: 'approved' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error approving transfer stock:', error);
    throw error;
  }

  try {
    await logStatusChange(ENTITY_TYPES.TRANSFER_STOCK, id, 'submitted', 'approved');
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  return await getTransferStock(id);
}

/**
 * Delete (soft delete) a Transfer Stock
 */
export async function deleteTransferStock(id: string): Promise<void> {
  // Check if transfer exists
  const existingTransfer = await getTransferStock(id);
  if (!existingTransfer) {
    throw new Error('Transfer Stock not found');
  }

  // Only allow deleting if status is 'pending' or 'submitted'
  if (existingTransfer.status === 'approved') {
    throw new Error('Approved transfer stocks cannot be deleted');
  }

  const { error } = await supabase
    .from('branch_inventory_transfers')
    .update({
      status: 'deleted',
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error deleting transfer stock:', error);
    throw error;
  }

  try {
    await logDelete(ENTITY_TYPES.TRANSFER_STOCK, id, {
      transfer_no: existingTransfer.transfer_no,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

/**
 * Add an item to a Transfer Stock
 */
export async function addTransferStockItem(
  transferId: string,
  item: Omit<TransferStockItem, 'id' | 'transfer_id' | 'created_at'>
): Promise<TransferStockItem> {
  // Check if transfer exists and is in pending status
  const existingTransfer = await getTransferStock(transferId);
  if (!existingTransfer) {
    throw new Error('Transfer Stock not found');
  }

  if (existingTransfer.status !== 'pending') {
    throw new Error('Can only add items to pending transfer stocks');
  }

  const { data, error } = await supabase
    .from('branch_inventory_transfer_items')
    .insert({
      transfer_id: transferId,
      item_id: item.item_id,
      from_warehouse_id: item.from_warehouse_id,
      to_warehouse_id: item.to_warehouse_id,
      transfer_qty: item.transfer_qty,
      notes: item.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding transfer item:', error);
    throw error;
  }

  return data as TransferStockItem;
}

/**
 * Update a Transfer Stock Item
 */
export async function updateTransferStockItem(
  itemId: string,
  updates: Partial<Pick<TransferStockItem, 'from_warehouse_id' | 'to_warehouse_id' | 'transfer_qty' | 'notes'>>
): Promise<TransferStockItem> {
  const { data, error } = await supabase
    .from('branch_inventory_transfer_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating transfer item:', error);
    throw error;
  }

  return data as TransferStockItem;
}

/**
 * Delete a Transfer Stock Item
 */
export async function deleteTransferStockItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('branch_inventory_transfer_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting transfer item:', error);
    throw error;
  }
}

/**
 * Get available stock for an item in a warehouse
 */
export async function getAvailableStock(itemId: string, warehouseId: string): Promise<number> {
  const warehouseColumn = `stock_wh${warehouseId}`;

  const { data, error } = await supabase
    .from('products')
    .select(warehouseColumn)
    .eq('id', itemId)
    .single();

  if (error) {
    console.error('Error fetching available stock:', error);
    return 0;
  }

  return data?.[warehouseColumn] || 0;
}
