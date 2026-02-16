import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';

export interface InventoryReportFilters {
  category?: string;
  partNumber?: string;
  itemCode?: string;
  stockStatus?: 'all' | 'with_stock' | 'without_stock';
  reportType?: 'inventory' | 'product';
}

export interface InventoryReportRow {
  id: string;
  partNo: string;
  itemCode: string;
  description: string;
  category: string;
  warehouseStock: Record<string, number>;
  totalStock: number;
}

export const WAREHOUSES = [
  { id: 'WH1', name: 'Warehouse 1' },
  { id: 'WH2', name: 'Warehouse 2' },
  { id: 'WH3', name: 'Warehouse 3' },
  { id: 'WH4', name: 'Warehouse 4' },
  { id: 'WH5', name: 'Warehouse 5' },
  { id: 'WH6', name: 'Warehouse 6' },
];

export const fetchCategories = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('is_deleted', false)
      .not('category', 'is', null);

    if (error) throw error;

    const categories = [...new Set(data?.map((p) => p.category).filter(Boolean) || [])];
    return categories.sort();
  } catch (err) {
    console.error('Error fetching categories:', err);
    return [];
  }
};

export const fetchPartNumbers = async (): Promise<{ id: string; partNo: string }[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, part_no')
      .eq('is_deleted', false)
      .order('part_no', { ascending: true });

    if (error) throw error;

    return (data || []).map((p) => ({ id: p.id, partNo: p.part_no }));
  } catch (err) {
    console.error('Error fetching part numbers:', err);
    return [];
  }
};

export const fetchItemCodes = async (): Promise<{ id: string; itemCode: string }[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, item_code')
      .eq('is_deleted', false)
      .not('item_code', 'is', null)
      .order('item_code', { ascending: true });

    if (error) throw error;

    return (data || []).map((p) => ({ id: p.id, itemCode: p.item_code }));
  } catch (err) {
    console.error('Error fetching item codes:', err);
    return [];
  }
};

export const fetchInventoryReport = async (
  filters: InventoryReportFilters
): Promise<InventoryReportRow[]> => {
  try {
    let query = supabase
      .from('products')
      .select('id, part_no, item_code, description, category, stock_wh1, stock_wh2, stock_wh3, stock_wh4, stock_wh5, stock_wh6')
      .eq('is_deleted', false);

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.partNumber) {
      query = query.ilike('part_no', `%${filters.partNumber}%`);
    }

    if (filters.itemCode) {
      query = query.ilike('item_code', `%${filters.itemCode}%`);
    }

    query = query.order('part_no', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    const rows: InventoryReportRow[] = (data || []).map((product: any) => {
      const warehouseStock: Record<string, number> = {
        WH1: product.stock_wh1 || 0,
        WH2: product.stock_wh2 || 0,
        WH3: product.stock_wh3 || 0,
        WH4: product.stock_wh4 || 0,
        WH5: product.stock_wh5 || 0,
        WH6: product.stock_wh6 || 0,
      };

      const totalStock = Object.values(warehouseStock).reduce((sum, qty) => sum + qty, 0);

      return {
        id: product.id,
        partNo: product.part_no || '',
        itemCode: product.item_code || '',
        description: product.description || '',
        category: product.category || '',
        warehouseStock,
        totalStock,
      };
    });

    if (filters.stockStatus === 'with_stock') {
      return rows.filter((row) => row.totalStock > 0);
    }

    if (filters.stockStatus === 'without_stock') {
      return rows.filter((row) => row.totalStock === 0);
    }

    return rows;
  } catch (err) {
    console.error('Error fetching inventory report:', err);
    return [];
  }
};
