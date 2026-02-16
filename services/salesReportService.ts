import { supabase } from '../lib/supabaseClient';
import {
  SalesReportFilters,
  SalesReportData,
  SalesReportTransaction,
  SalesReportSummary,
  CategoryTotal,
  SalespersonTotal,
  GrandTotal,
  CustomerOption,
} from '../types';

export const getCustomerList = async (): Promise<CustomerOption[]> => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, company')
      .eq('is_deleted', false)
      .order('company', { ascending: true });

    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }

    return (data || []).map((c) => ({
      id: c.id,
      company: c.company || 'Unknown',
    }));
  } catch (err) {
    console.error('Error in getCustomerList:', err);
    return [];
  }
};

const applyTaxMultiplier = (amount: number, vatType: string | null): number => {
  if (vatType?.toLowerCase() === 'exclusive') {
    return amount * 1.12;
  }
  return amount;
};

const getCategoryFromItems = async (
  itemIds: string[]
): Promise<Record<string, string>> => {
  if (itemIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, category')
      .in('id', itemIds);

    if (error) {
      console.error('Error fetching product categories:', error);
      return {};
    }

    const categoryMap: Record<string, string> = {};
    (data || []).forEach((p) => {
      categoryMap[p.id] = p.category || 'Uncategorized';
    });
    return categoryMap;
  } catch (err) {
    console.error('Error in getCategoryFromItems:', err);
    return {};
  }
};

export const getSalesReportData = async (
  filters: SalesReportFilters
): Promise<SalesReportData> => {
  try {
    const transactions: SalesReportTransaction[] = [];

    let invoiceQuery = supabase
      .from('invoices')
      .select(`
        id,
        invoice_no,
        order_id,
        contact_id,
        sales_date,
        sales_person,
        terms,
        grand_total,
        status,
        contacts!invoices_contact_id_fkey(company, vatType),
        sales_orders!invoices_order_id_fkey(order_no, grand_total)
      `)
      .eq('is_deleted', false)
      .gte('sales_date', filters.dateFrom)
      .lte('sales_date', filters.dateTo);

    if (filters.customerId !== 'all') {
      invoiceQuery = invoiceQuery.eq('contact_id', filters.customerId);
    }

    const { data: invoices, error: invoiceError } = await invoiceQuery;

    if (invoiceError) {
      console.error('Error fetching invoices:', invoiceError);
    }

    // Use raw query approach for new tables not yet in types
    const drQueryBase = `
      id,
      dr_no,
      order_id,
      contact_id,
      sales_date,
      sales_person,
      terms,
      grand_total,
      status,
      contacts(company, vatType),
      sales_orders(order_no, grand_total)
    `;

    let drData: any[] = [];
    try {
      const { data, error } = await (supabase as any)
        .from('delivery_receipts')
        .select(drQueryBase)
        .eq('is_deleted', false)
        .gte('sales_date', filters.dateFrom)
        .lte('sales_date', filters.dateTo)
        .then((res: any) => {
          if (filters.customerId !== 'all') {
            return (supabase as any)
              .from('delivery_receipts')
              .select(drQueryBase)
              .eq('is_deleted', false)
              .gte('sales_date', filters.dateFrom)
              .lte('sales_date', filters.dateTo)
              .eq('contact_id', filters.customerId);
          }
          return res;
        });
      
      if (!error) {
        drData = data || [];
      }
    } catch (e) {
      // Table might not exist yet, continue with empty array
      console.log('Delivery receipts table not available:', e);
    }

    // Fetch delivery receipts separately to handle new table
    let deliveryReceipts: any[] = [];
    try {
      let query = (supabase as any)
        .from('delivery_receipts')
        .select(drQueryBase)
        .eq('is_deleted', false)
        .gte('sales_date', filters.dateFrom)
        .lte('sales_date', filters.dateTo);

      if (filters.customerId !== 'all') {
        query = query.eq('contact_id', filters.customerId);
      }

      const { data, error } = await query;
      if (!error && data) {
        deliveryReceipts = data;
      }
    } catch (e) {
      console.log('Delivery receipts query failed:', e);
    }

    const allInvoiceIds = (invoices || []).map((inv: any) => inv.id);
    const allDrIds = deliveryReceipts.map((dr: any) => dr.id);

    let invoiceItemIds: string[] = [];
    let drItemIds: string[] = [];

    if (allInvoiceIds.length > 0) {
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select('invoice_id, item_id')
        .in('invoice_id', allInvoiceIds);

      invoiceItemIds = (invoiceItems || [])
        .map((item: any) => item.item_id)
        .filter(Boolean);
    }

    if (allDrIds.length > 0) {
      try {
        const { data: drItems } = await (supabase as any)
          .from('delivery_receipt_items')
          .select('dr_id, item_id')
          .in('dr_id', allDrIds);

        drItemIds = (drItems || [])
          .map((item: any) => item.item_id)
          .filter(Boolean);
      } catch (e) {
        console.log('DR items query failed:', e);
      }
    }

    const allItemIds = [...new Set([...invoiceItemIds, ...drItemIds])];
    const categoryMap = await getCategoryFromItems(allItemIds);

    const getPrimaryCategory = (itemIds: string[]): string => {
      for (const id of itemIds) {
        if (categoryMap[id]) {
          return categoryMap[id];
        }
      }
      return 'Uncategorized';
    };

    for (const invoice of invoices || []) {
      const inv = invoice as any;
      const contact = inv.contacts;
      const salesOrder = inv.sales_orders;
      const vatType = contact?.vatType?.toLowerCase() || null;

      const invoiceAmount = applyTaxMultiplier(inv.grand_total || 0, vatType);
      const soAmount = salesOrder?.grand_total
        ? applyTaxMultiplier(salesOrder.grand_total, vatType)
        : 0;

      const relevantItemIds = invoiceItemIds.filter((id) =>
        allInvoiceIds.includes(inv.id)
      );
      const category = getPrimaryCategory(relevantItemIds);

      transactions.push({
        id: inv.id,
        date: inv.sales_date,
        customer: contact?.company || 'Unknown',
        customerId: inv.contact_id,
        terms: inv.terms || '',
        refNo: inv.invoice_no,
        soNo: salesOrder?.order_no || '',
        soAmount,
        drAmount: 0,
        invoiceAmount,
        salesperson: inv.sales_person || 'Unknown',
        category,
        vatType,
        type: 'invoice',
      });
    }

    for (const dr of deliveryReceipts) {
      const drRecord = dr as any;
      const contact = drRecord.contacts;
      const salesOrder = drRecord.sales_orders;
      const vatType = contact?.vatType?.toLowerCase() || null;

      const drAmount = applyTaxMultiplier(drRecord.grand_total || 0, vatType);
      const soAmount = salesOrder?.grand_total
        ? applyTaxMultiplier(salesOrder.grand_total, vatType)
        : 0;

      const relevantItemIds = drItemIds.filter((id) =>
        allDrIds.includes(drRecord.id)
      );
      const category = getPrimaryCategory(relevantItemIds);

      transactions.push({
        id: drRecord.id,
        date: drRecord.sales_date,
        customer: contact?.company || 'Unknown',
        customerId: drRecord.contact_id,
        terms: drRecord.terms || '',
        refNo: drRecord.dr_no,
        soNo: salesOrder?.order_no || '',
        soAmount,
        drAmount,
        invoiceAmount: 0,
        salesperson: drRecord.sales_person || 'Unknown',
        category,
        vatType,
        type: 'dr',
      });
    }

    transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const summary = calculateSummary(transactions);

    return { transactions, summary };
  } catch (err) {
    console.error('Error in getSalesReportData:', err);
    return {
      transactions: [],
      summary: {
        categoryTotals: [],
        salespersonTotals: [],
        grandTotal: { soAmount: 0, drAmount: 0, invoiceAmount: 0, total: 0 },
      },
    };
  }
};

const calculateSummary = (
  transactions: SalesReportTransaction[]
): SalesReportSummary => {
  const categoryMap = new Map<string, CategoryTotal>();
  const salespersonMap = new Map<string, Map<string, CategoryTotal>>();

  let grandSoAmount = 0;
  let grandDrAmount = 0;
  let grandInvoiceAmount = 0;

  for (const tx of transactions) {
    grandSoAmount += tx.soAmount;
    grandDrAmount += tx.drAmount;
    grandInvoiceAmount += tx.invoiceAmount;

    const existing = categoryMap.get(tx.category) || {
      category: tx.category,
      soAmount: 0,
      drAmount: 0,
      invoiceAmount: 0,
    };
    existing.soAmount += tx.soAmount;
    existing.drAmount += tx.drAmount;
    existing.invoiceAmount += tx.invoiceAmount;
    categoryMap.set(tx.category, existing);

    if (!salespersonMap.has(tx.salesperson)) {
      salespersonMap.set(tx.salesperson, new Map<string, CategoryTotal>());
    }
    const spCategoryMap = salespersonMap.get(tx.salesperson)!;
    const spExisting = spCategoryMap.get(tx.category) || {
      category: tx.category,
      soAmount: 0,
      drAmount: 0,
      invoiceAmount: 0,
    };
    spExisting.soAmount += tx.soAmount;
    spExisting.drAmount += tx.drAmount;
    spExisting.invoiceAmount += tx.invoiceAmount;
    spCategoryMap.set(tx.category, spExisting);
  }

  const categoryTotals: CategoryTotal[] = Array.from(categoryMap.values());

  const salespersonTotals: SalespersonTotal[] = [];
  salespersonMap.forEach((catMap, salesperson) => {
    const categories = Array.from(catMap.values());
    const total = categories.reduce(
      (sum, c) => sum + c.soAmount + c.drAmount + c.invoiceAmount,
      0
    );
    salespersonTotals.push({ salesperson, categories, total });
  });

  salespersonTotals.sort((a, b) => b.total - a.total);

  const grandTotal: GrandTotal = {
    soAmount: grandSoAmount,
    drAmount: grandDrAmount,
    invoiceAmount: grandInvoiceAmount,
    total: grandSoAmount + grandDrAmount + grandInvoiceAmount,
  };

  return { categoryTotals, salespersonTotals, grandTotal };
};

export const getTransactionDetails = async (
  transactionId: string,
  type: 'invoice' | 'dr'
): Promise<any[]> => {
  try {
    if (type === 'invoice') {
      const { data, error } = await supabase
        .from('invoice_items')
        .select(`
          id,
          qty,
          part_no,
          item_code,
          description,
          unit_price,
          amount,
          products!invoice_items_item_id_fkey(brand, category)
        `)
        .eq('invoice_id', transactionId);

      if (error) {
        console.error('Error fetching invoice items:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        qty: item.qty,
        partNo: item.part_no,
        itemCode: item.item_code,
        description: item.description,
        unitPrice: item.unit_price,
        amount: item.amount,
        brand: item.products?.brand || '',
        category: item.products?.category || 'Uncategorized',
      }));
    } else {
      try {
        const { data, error } = await (supabase as any)
          .from('delivery_receipt_items')
          .select(`
            id,
            qty,
            part_no,
            item_code,
            description,
            unit_price,
            amount,
            products(brand, category)
          `)
          .eq('dr_id', transactionId);

        if (error) {
          console.error('Error fetching DR items:', error);
          return [];
        }

        return (data || []).map((item: any) => ({
          id: item.id,
          qty: item.qty,
          partNo: item.part_no,
          itemCode: item.item_code,
          description: item.description,
          unitPrice: item.unit_price,
          amount: item.amount,
          brand: item.products?.brand || '',
          category: item.products?.category || 'Uncategorized',
        }));
      } catch (e) {
        console.error('Error fetching DR items:', e);
        return [];
      }
    }
  } catch (err) {
    console.error('Error in getTransactionDetails:', err);
    return [];
  }
};
