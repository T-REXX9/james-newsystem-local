import { supabase } from '../lib/supabaseClient';
import type { FastSlowMovementItem, FastSlowReportData, FastSlowReportFilters, MovementCategory } from '../types';

interface MonthPeriod {
  start: Date;
  end: Date;
  label: string;
}

function getThreeMonthPeriods(): { month1: MonthPeriod; month2: MonthPeriod; month3: MonthPeriod } {
  const today = new Date();

  const month3End = new Date(today.getFullYear(), today.getMonth(), 0);
  const month3Start = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const month2End = new Date(today.getFullYear(), today.getMonth() - 1, 0);
  const month2Start = new Date(today.getFullYear(), today.getMonth() - 2, 1);

  const month1End = new Date(today.getFullYear(), today.getMonth() - 2, 0);
  const month1Start = new Date(today.getFullYear(), today.getMonth() - 3, 1);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    month1: {
      start: month1Start,
      end: month1End,
      label: monthNames[month1Start.getMonth()],
    },
    month2: {
      start: month2Start,
      end: month2End,
      label: monthNames[month2Start.getMonth()],
    },
    month3: {
      start: month3Start,
      end: month3End,
      label: monthNames[month3Start.getMonth()],
    },
  };
}

function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0];
}

function categorizeMovement(month1Sales: number, month2Sales: number, month3Sales: number): MovementCategory {
  if (month2Sales === 0 && month3Sales === 0) {
    return 'slow';
  }

  if (month2Sales > month3Sales) {
    return 'slow';
  }

  if (month2Sales < month3Sales) {
    return 'fast';
  }

  return 'slow';
}

export async function generateFastSlowReport(filters: FastSlowReportFilters): Promise<FastSlowReportData> {
  const periods = getThreeMonthPeriods();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, part_no, item_code, description')
    .eq('is_deleted', false);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    throw productsError;
  }

  if (!products || products.length === 0) {
    return {
      fastMovingItems: [],
      slowMovingItems: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const productIds = products.map(p => p.id);

  const { data: allLogs, error: logsError } = await (supabase as any)
    .from('inventory_logs')
    .select('item_id, date, qty_in, qty_out, transaction_type')
    .in('item_id', productIds)
    .eq('is_deleted', false);

  if (logsError) {
    console.error('Error fetching inventory logs:', logsError);
    throw logsError;
  }

  const { data: poItems, error: poError } = await (supabase as any)
    .from('purchase_order_items')
    .select(`
      item_id,
      qty,
      purchase_orders!inner (
        order_date,
        delivery_date,
        status
      )
    `)
    .in('item_id', productIds);

  if (poError) {
    console.error('Error fetching purchase order items:', poError);
  }

  const items: FastSlowMovementItem[] = [];

  for (const product of products) {
    const productLogs = (allLogs || []).filter((log: any) => log.item_id === product.id);
    const productPOItems = (poItems || []).filter((poi: any) => poi.item_id === product.id);

    let firstArrivalDate: string | null = null;
    if (productPOItems.length > 0) {
      const deliveredPOs = productPOItems
        .filter((poi: any) => poi.purchase_orders?.status === 'delivered' && poi.purchase_orders?.delivery_date)
        .map((poi: any) => poi.purchase_orders.delivery_date)
        .sort();
      if (deliveredPOs.length > 0) {
        firstArrivalDate = deliveredPOs[0];
      }
    }

    let totalPurchased = 0;
    let totalSold = 0;

    for (const log of productLogs) {
      totalPurchased += log.qty_in || 0;
      totalSold += log.qty_out || 0;
    }

    const month1Start = formatDateForDB(periods.month1.start);
    const month1End = formatDateForDB(periods.month1.end);
    const month2Start = formatDateForDB(periods.month2.start);
    const month2End = formatDateForDB(periods.month2.end);
    const month3Start = formatDateForDB(periods.month3.start);
    const month3End = formatDateForDB(periods.month3.end);

    let month1Sales = 0;
    let month2Sales = 0;
    let month3Sales = 0;

    for (const log of productLogs) {
      const logDate = log.date.split('T')[0];
      const qtyOut = log.qty_out || 0;

      if (logDate >= month1Start && logDate <= month1End) {
        month1Sales += qtyOut;
      } else if (logDate >= month2Start && logDate <= month2End) {
        month2Sales += qtyOut;
      } else if (logDate >= month3Start && logDate <= month3End) {
        month3Sales += qtyOut;
      }
    }

    const category = categorizeMovement(month1Sales, month2Sales, month3Sales);

    if (totalPurchased > 0 || totalSold > 0) {
      items.push({
        item_id: product.id,
        part_no: product.part_no || '',
        item_code: product.item_code || '',
        description: product.description || '',
        first_arrival_date: firstArrivalDate,
        total_purchased: totalPurchased,
        total_sold: totalSold,
        month1_sales: month1Sales,
        month2_sales: month2Sales,
        month3_sales: month3Sales,
        month1_label: periods.month1.label,
        month2_label: periods.month2.label,
        month3_label: periods.month3.label,
        category,
      });
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    if (filters.sortBy === 'sales_volume') {
      const totalA = a.month1_sales + a.month2_sales + a.month3_sales;
      const totalB = b.month1_sales + b.month2_sales + b.month3_sales;
      return filters.sortDirection === 'asc' ? totalA - totalB : totalB - totalA;
    } else {
      const compare = a.part_no.localeCompare(b.part_no);
      return filters.sortDirection === 'asc' ? compare : -compare;
    }
  });

  const fastMovingItems = sortedItems.filter(item => item.category === 'fast');
  const slowMovingItems = sortedItems.filter(item => item.category === 'slow');

  return {
    fastMovingItems,
    slowMovingItems,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight function to fetch movement classification for all products.
 * Returns a Map of product_id -> classification ('fast' | 'slow' | 'normal')
 */
export async function fetchProductMovementClassifications(): Promise<Map<string, MovementCategory>> {
  const result = new Map<string, MovementCategory>();
  const periods = getThreeMonthPeriods();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .eq('is_deleted', false);

  if (productsError || !products || products.length === 0) {
    return result;
  }

  const productIds = products.map(p => p.id);

  const { data: allLogs, error: logsError } = await (supabase as any)
    .from('inventory_logs')
    .select('item_id, date, qty_out')
    .in('item_id', productIds)
    .eq('is_deleted', false);

  if (logsError || !allLogs) {
    return result;
  }

  const month2Start = formatDateForDB(periods.month2.start);
  const month2End = formatDateForDB(periods.month2.end);
  const month3Start = formatDateForDB(periods.month3.start);
  const month3End = formatDateForDB(periods.month3.end);

  for (const product of products) {
    const productLogs = allLogs.filter((log: any) => log.item_id === product.id);

    let month2Sales = 0;
    let month3Sales = 0;
    let hasActivity = false;

    for (const log of productLogs) {
      const logDate = log.date?.split('T')[0];
      const qtyOut = log.qty_out || 0;

      if (qtyOut > 0) hasActivity = true;

      if (logDate >= month2Start && logDate <= month2End) {
        month2Sales += qtyOut;
      } else if (logDate >= month3Start && logDate <= month3End) {
        month3Sales += qtyOut;
      }
    }

    // Only classify if there's activity
    if (hasActivity) {
      const category = categorizeMovement(0, month2Sales, month3Sales);
      result.set(product.id, category);
    }
  }

  return result;
}
