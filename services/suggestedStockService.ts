import { supabase } from '../lib/supabaseClient';

const db = supabase as any;

export interface SuggestedStockFilters {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
}

export interface SuggestedStockItem {
  id: string;
  partNo: string;
  itemCode: string;
  description: string;
  inquiryCount: number;
  totalQty: number;
  customerCount: number;
  customers: { id: string; name: string }[];
  remark: string;
  lastInquiryDate: string;
}

export interface SuggestedStockDetail {
  id: string;
  inquiryId: string;
  inquiryNo: string;
  inquiryDate: string;
  customerId: string;
  customerName: string;
  partNo: string;
  itemCode: string;
  description: string;
  qty: number;
  remark: string;
  salesPerson: string;
}

export interface CustomerWithInquiries {
  id: string;
  company: string;
  inquiryCount: number;
}

export interface SupplierOption {
  id: string;
  company: string;
}

export interface PurchaseOrderOption {
  id: string;
  poNo: string;
  supplierName: string;
  status: string;
}

export const fetchCustomersWithNotListedInquiries = async (
  dateFrom: string,
  dateTo: string
): Promise<CustomerWithInquiries[]> => {
  try {
    const { data, error } = await supabase
      .from('sales_inquiry_items')
      .select(`
        id,
        inquiry_id,
        sales_inquiries!inner (
          id,
          sales_date,
          contact_id,
          is_deleted,
          contacts!inner (
            id,
            company
          )
        )
      `)
      .is('item_id', null)
      .gte('sales_inquiries.sales_date', dateFrom)
      .lte('sales_inquiries.sales_date', dateTo)
      .eq('sales_inquiries.is_deleted', false);

    if (error) throw error;

    const customerMap = new Map<string, { company: string; count: number }>();

    (data || []).forEach((item: any) => {
      const contact = item.sales_inquiries?.contacts;
      if (contact) {
        const existing = customerMap.get(contact.id);
        if (existing) {
          existing.count += 1;
        } else {
          customerMap.set(contact.id, { company: contact.company, count: 1 });
        }
      }
    });

    const result: CustomerWithInquiries[] = Array.from(customerMap.entries()).map(
      ([id, data]) => ({
        id,
        company: data.company,
        inquiryCount: data.count,
      })
    );

    return result.sort((a, b) => b.inquiryCount - a.inquiryCount);
  } catch (err) {
    console.error('Error fetching customers with not listed inquiries:', err);
    return [];
  }
};

export const fetchSuggestedStockSummary = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockItem[]> => {
  try {
    let query = supabase
      .from('sales_inquiry_items')
      .select(`
        id,
        part_no,
        item_code,
        description,
        qty,
        remark,
        report_remark,
        inquiry_id,
        sales_inquiries!inner (
          id,
          inquiry_no,
          sales_date,
          contact_id,
          is_deleted,
          contacts!inner (
            id,
            company
          )
        )
      `)
      .is('item_id', null)
      .gte('sales_inquiries.sales_date', filters.dateFrom)
      .lte('sales_inquiries.sales_date', filters.dateTo)
      .eq('sales_inquiries.is_deleted', false);

    if (filters.customerId && filters.customerId !== 'all') {
      query = query.eq('sales_inquiries.contact_id', filters.customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const itemMap = new Map<
      string,
      {
        partNo: string;
        itemCode: string;
        description: string;
        totalQty: number;
        customers: Map<string, string>;
        remark: string;
        lastDate: string;
        ids: string[];
      }
    >();

    (data || []).forEach((item: any) => {
      const key = `${item.part_no || ''}|${item.item_code || ''}|${item.description || ''}`.toLowerCase();
      const contact = item.sales_inquiries?.contacts;
      const inquiryDate = item.sales_inquiries?.sales_date || '';

      const existing = itemMap.get(key);
      if (existing) {
        existing.totalQty += item.qty || 0;
        existing.ids.push(item.id);
        if (contact) {
          existing.customers.set(contact.id, contact.company);
        }
        if (inquiryDate > existing.lastDate) {
          existing.lastDate = inquiryDate;
        }
        if (item.report_remark && !existing.remark) {
          existing.remark = item.report_remark;
        }
      } else {
        const customers = new Map<string, string>();
        if (contact) {
          customers.set(contact.id, contact.company);
        }
        itemMap.set(key, {
          partNo: item.part_no || '',
          itemCode: item.item_code || '',
          description: item.description || '',
          totalQty: item.qty || 0,
          customers,
          remark: item.report_remark || '',
          lastDate: inquiryDate,
          ids: [item.id],
        });
      }
    });

    const result: SuggestedStockItem[] = Array.from(itemMap.entries()).map(
      ([_, data]) => ({
        id: data.ids[0],
        partNo: data.partNo,
        itemCode: data.itemCode,
        description: data.description,
        inquiryCount: data.ids.length,
        totalQty: data.totalQty,
        customerCount: data.customers.size,
        customers: Array.from(data.customers.entries()).map(([id, name]) => ({
          id,
          name,
        })),
        remark: data.remark,
        lastInquiryDate: data.lastDate,
      })
    );

    return result.sort((a, b) => b.inquiryCount - a.inquiryCount);
  } catch (err) {
    console.error('Error fetching suggested stock summary:', err);
    return [];
  }
};

export const fetchSuggestedStockDetails = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockDetail[]> => {
  try {
    let query = supabase
      .from('sales_inquiry_items')
      .select(`
        id,
        part_no,
        item_code,
        description,
        qty,
        remark,
        inquiry_id,
        sales_inquiries!inner (
          id,
          inquiry_no,
          sales_date,
          sales_person,
          contact_id,
          is_deleted,
          contacts!inner (
            id,
            company
          )
        )
      `)
      .is('item_id', null)
      .gte('sales_inquiries.sales_date', filters.dateFrom)
      .lte('sales_inquiries.sales_date', filters.dateTo)
      .eq('sales_inquiries.is_deleted', false)
      .order('sales_inquiries(sales_date)', { ascending: false });

    if (filters.customerId && filters.customerId !== 'all') {
      query = query.eq('sales_inquiries.contact_id', filters.customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      inquiryId: item.inquiry_id,
      inquiryNo: item.sales_inquiries?.inquiry_no || '',
      inquiryDate: item.sales_inquiries?.sales_date || '',
      customerId: item.sales_inquiries?.contact_id || '',
      customerName: item.sales_inquiries?.contacts?.company || '',
      partNo: item.part_no || '',
      itemCode: item.item_code || '',
      description: item.description || '',
      qty: item.qty || 0,
      remark: item.remark || '',
      salesPerson: item.sales_inquiries?.sales_person || '',
    }));
  } catch (err) {
    console.error('Error fetching suggested stock details:', err);
    return [];
  }
};

export const updateItemRemark = async (
  itemId: string,
  remark: string
): Promise<boolean> => {
  try {
    const { error } = await db
      .from('sales_inquiry_items')
      .update({ report_remark: remark })
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating item remark:', err);
    return false;
  }
};

export const fetchSuppliers = async (): Promise<SupplierOption[]> => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, company')
      .or('status.eq.supplier,status.ilike.%supplier%')
      .eq('is_deleted', false)
      .order('company');

    if (error) throw error;

    return (data || []).map((s: any) => ({
      id: s.id,
      company: s.company,
    }));
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    return [];
  }
};

export const fetchPurchaseOrders = async (): Promise<PurchaseOrderOption[]> => {
  try {
    const { data, error } = await db
      .from('purchase_orders')
      .select(`
        id,
        po_no,
        status,
        supplier_id,
        contacts!purchase_orders_supplier_id_fkey (
          company
        )
      `)
      .in('status', ['draft', 'ordered'])
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((po: any) => ({
      id: po.id,
      poNo: po.po_no,
      supplierName: po.contacts?.company || 'Unknown Supplier',
      status: po.status,
    }));
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    return [];
  }
};

export const addItemToPurchaseOrder = async (
  poId: string,
  item: {
    partNo: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
  }
): Promise<boolean> => {
  try {
    const { error } = await db.from('purchase_order_items').insert({
      po_id: poId,
      item_id: null,
      qty: item.qty,
      unit_price: item.unitPrice,
      notes: `Part: ${item.partNo} | Code: ${item.itemCode} | ${item.description}`,
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding item to purchase order:', err);
    return false;
  }
};

export const createPurchaseOrderWithItem = async (
  supplierId: string,
  warehouseId: string,
  item: {
    partNo: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
  },
  userId: string
): Promise<string | null> => {
  try {
    const { data: lastPo } = await db
      .from('purchase_orders')
      .select('po_no')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextPoNo = 'PO-0001';
    if (lastPo?.po_no) {
      const lastNum = parseInt(lastPo.po_no.replace('PO-', ''), 10);
      nextPoNo = `PO-${String(lastNum + 1).padStart(4, '0')}`;
    }

    const { data: newPo, error: poError } = await db
      .from('purchase_orders')
      .insert({
        po_no: nextPoNo,
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        order_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        grand_total: item.qty * item.unitPrice,
        created_by: userId,
      })
      .select('id')
      .single();

    if (poError) throw poError;

    const { error: itemError } = await db.from('purchase_order_items').insert({
      po_id: newPo.id,
      item_id: null,
      qty: item.qty,
      unit_price: item.unitPrice,
      notes: `Part: ${item.partNo} | Code: ${item.itemCode} | ${item.description}`,
    });

    if (itemError) throw itemError;

    return newPo.id;
  } catch (err) {
    console.error('Error creating purchase order with item:', err);
    return null;
  }
};
