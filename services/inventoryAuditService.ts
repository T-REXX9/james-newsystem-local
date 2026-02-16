import { supabase } from '../lib/supabaseClient';
import type { InventoryAuditFilters, InventoryAuditRecord, InventoryAuditReportData, Product } from '../types';

function getDateRange(filters: InventoryAuditFilters): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (filters.timePeriod) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'week':
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      break;
    case 'custom':
      from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(now.getFullYear(), 0, 1);
      to = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : to;
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, part_no, item_code, description, brand')
    .eq('is_deleted', false)
    .order('part_no', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return (data || []) as Product[];
}

export async function generateInventoryAuditReport(
  filters: InventoryAuditFilters
): Promise<InventoryAuditReportData> {
  const dateRange = getDateRange(filters);

  let adjustmentsQuery = (supabase as any)
    .from('stock_adjustments')
    .select(`
      id,
      adjustment_no,
      adjustment_date,
      adjustment_type,
      warehouse_id,
      notes,
      status,
      processed_by,
      stock_adjustment_items (
        id,
        item_id,
        system_qty,
        physical_qty,
        difference,
        reason
      )
    `)
    .eq('is_deleted', false)
    .eq('status', 'finalized')
    .gte('adjustment_date', dateRange.from)
    .lte('adjustment_date', dateRange.to)
    .order('adjustment_date', { ascending: false });

  const { data: adjustments, error: adjustmentsError } = await adjustmentsQuery;

  if (adjustmentsError) {
    console.error('Error fetching stock adjustments:', adjustmentsError);
    throw adjustmentsError;
  }

  if (!adjustments || adjustments.length === 0) {
    return {
      records: [],
      totalAdjustments: 0,
      totalPositive: 0,
      totalNegative: 0,
      generatedAt: new Date().toISOString(),
      filters,
    };
  }

  const itemIds = new Set<string>();
  const processorIds = new Set<string>();

  for (const adj of adjustments) {
    if (adj.processed_by) processorIds.add(adj.processed_by);
    for (const item of adj.stock_adjustment_items || []) {
      if (item.item_id) itemIds.add(item.item_id);
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, item_code, part_no, description, brand')
    .in('id', Array.from(itemIds));

  if (productsError) {
    console.error('Error fetching products:', productsError);
  }

  const productMap = new Map<string, any>();
  for (const product of products || []) {
    productMap.set(product.id, product);
  }

  let processorMap = new Map<string, string>();
  if (processorIds.size > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(processorIds));

    if (!profilesError && profiles) {
      for (const profile of profiles) {
        processorMap.set(profile.id, profile.full_name || profile.email || 'Unknown');
      }
    }
  }

  const records: InventoryAuditRecord[] = [];
  let totalPositive = 0;
  let totalNegative = 0;

  for (const adj of adjustments) {
    for (const item of adj.stock_adjustment_items || []) {
      const product = productMap.get(item.item_id);

      if (!product) continue;

      if (filters.partNo && product.part_no !== filters.partNo) continue;
      if (filters.itemCode && product.item_code !== filters.itemCode) continue;

      if (item.difference > 0) totalPositive += item.difference;
      if (item.difference < 0) totalNegative += Math.abs(item.difference);

      records.push({
        id: item.id,
        item_id: item.item_id,
        item_code: product.item_code || '',
        part_no: product.part_no || '',
        description: product.description || '',
        brand: product.brand || '',
        adjustment_date: adj.adjustment_date,
        adjustment_type: adj.adjustment_type,
        adjustment_no: adj.adjustment_no,
        warehouse_id: adj.warehouse_id,
        system_qty: item.system_qty,
        physical_qty: item.physical_qty,
        difference: item.difference,
        reason: item.reason || '',
        processed_by: adj.processed_by || '',
        processor_name: processorMap.get(adj.processed_by) || 'System',
        notes: adj.notes || '',
      });
    }
  }

  records.sort((a, b) => new Date(b.adjustment_date).getTime() - new Date(a.adjustment_date).getTime());

  return {
    records,
    totalAdjustments: records.length,
    totalPositive,
    totalNegative,
    generatedAt: new Date().toISOString(),
    filters,
  };
}
