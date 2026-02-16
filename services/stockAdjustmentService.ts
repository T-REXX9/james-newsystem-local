import { supabase } from '../lib/supabaseClient';
import type { StockAdjustment, StockAdjustmentDTO } from '../types';
import { createInventoryLogFromStockAdjustment } from './inventoryLogService';
import { ENTITY_TYPES, logCreate, logStatusChange } from './activityLogService';

/**
 * Create a new Stock Adjustment
 */
export async function createStockAdjustment(data: StockAdjustmentDTO): Promise<StockAdjustment> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Create the stock adjustment
  const { data: adjustment, error: adjustmentError } = await supabase
    .from('stock_adjustments')
    .insert({
      adjustment_no: data.adjustment_no,
      adjustment_date: data.adjustment_date,
      warehouse_id: data.warehouse_id,
      adjustment_type: data.adjustment_type,
      notes: data.notes,
      status: 'draft',
      processed_by: null,
      is_deleted: false,
    })
    .select()
    .single();

  if (adjustmentError || !adjustment) {
    console.error('Error creating stock adjustment:', adjustmentError);
    throw adjustmentError || new Error('Failed to create stock adjustment');
  }

  // Create stock adjustment items with calculated differences
  const itemsToInsert = data.items.map(item => ({
    adjustment_id: adjustment.id,
    item_id: item.item_id,
    system_qty: item.system_qty,
    physical_qty: item.physical_qty,
    difference: item.physical_qty - item.system_qty,
    reason: item.reason,
  }));

  const { error: itemsError } = await supabase
    .from('stock_adjustment_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('Error creating stock adjustment items:', itemsError);
    // Rollback: delete the adjustment
    await supabase.from('stock_adjustments').delete().eq('id', adjustment.id);
    throw itemsError;
  }

  try {
    await logCreate(ENTITY_TYPES.STOCK_ADJUSTMENT, adjustment.id, {
      adjustment_no: adjustment.adjustment_no,
      adjustment_type: adjustment.adjustment_type,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  // Fetch the complete adjustment with items
  return await getStockAdjustment(adjustment.id) as StockAdjustment;
}

/**
 * Get a Stock Adjustment by ID
 */
export async function getStockAdjustment(id: string): Promise<StockAdjustment | null> {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select(`
      *,
      stock_adjustment_items (*)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching stock adjustment:', error);
    return null;
  }

  return data as StockAdjustment;
}

/**
 * Finalize a Stock Adjustment
 * This triggers inventory log creation
 */
export async function finalizeAdjustment(id: string): Promise<StockAdjustment | null> {
  // Check if adjustment exists
  const existingAdjustment = await getStockAdjustment(id);
  if (!existingAdjustment) {
    throw new Error('Stock Adjustment not found');
  }

  // Only allow finalizing if status is 'draft'
  if (existingAdjustment.status !== 'draft') {
    throw new Error('Only draft stock adjustments can be finalized');
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Update status to 'finalized'
  const { data: adjustment, error: adjustmentError } = await supabase
    .from('stock_adjustments')
    .update({
      status: 'finalized',
      processed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (adjustmentError || !adjustment) {
    console.error('Error finalizing stock adjustment:', adjustmentError);
    throw adjustmentError || new Error('Failed to finalize stock adjustment');
  }

  try {
    await logStatusChange(ENTITY_TYPES.STOCK_ADJUSTMENT, id, 'draft', 'finalized');
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  // Create inventory logs
  try {
    await createInventoryLogFromStockAdjustment(id, user.id);
  } catch (error) {
    console.error('Error creating inventory logs:', error);
    // Note: We don't rollback the adjustment status update here
    // In production, you might want to handle this differently
  }

  // Fetch the complete updated adjustment
  return await getStockAdjustment(id) as StockAdjustment;
}

/**
 * Get all Stock Adjustments with optional filters
 */
export async function getAllStockAdjustments(
  filters?: { warehouseId?: string }
): Promise<StockAdjustment[]> {
  let query = supabase
    .from('stock_adjustments')
    .select(`
      *,
      stock_adjustment_items (*)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching stock adjustments:', error);
    throw error;
  }

  return data || [];
}
