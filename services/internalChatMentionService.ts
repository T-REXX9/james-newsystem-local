import { searchProducts } from './productLocalApiService';
import { getAllSalesInquiries } from './salesInquiryLocalApiService';
import { getSalesOrdersPage } from './salesOrderLocalApiService';
import { getOrderSlipsPage } from './orderSlipLocalApiService';
import { getInvoicesPage } from './invoiceLocalApiService';
import type { ChatMentionEntityType } from '../utils/internalChatMentionUtils';
import type { Invoice, OrderSlip, SalesInquiry, SalesOrder } from '../types';

export interface InternalChatEntityMentionSuggestion {
  entityType: ChatMentionEntityType;
  entityId: string;
  label: string;
  subtitle: string;
}

interface SearchInternalChatEntityMentionOptions {
  entityTypes?: ChatMentionEntityType[];
}

const MAX_SUGGESTIONS_PER_GROUP = 4;
const MENTION_PAGE_SIZE = 200;

let cachedSalesInquiriesPromise: ReturnType<typeof getAllSalesInquiries> | null = null;
let cachedSalesOrdersPromise: Promise<SalesOrder[]> | null = null;
let cachedOrderSlipsPromise: Promise<OrderSlip[]> | null = null;
let cachedInvoicesPromise: Promise<Invoice[]> | null = null;

const searchNeedle = (query: string) => String(query || '').trim().toLowerCase();

const matchesNeedle = (needle: string, ...values: Array<string | null | undefined>) =>
  values.some((value) => String(value || '').toLowerCase().includes(needle));

const limitResults = <T,>(items: T[]): T[] => items.slice(0, MAX_SUGGESTIONS_PER_GROUP);

const loadSalesInquiries = async () => {
  if (!cachedSalesInquiriesPromise) {
    cachedSalesInquiriesPromise = getAllSalesInquiries();
  }

  try {
    return await cachedSalesInquiriesPromise;
  } catch (error) {
    cachedSalesInquiriesPromise = null;
    throw error;
  }
};

const loadAllSalesOrders = async (): Promise<SalesOrder[]> => {
  if (!cachedSalesOrdersPromise) {
    cachedSalesOrdersPromise = (async () => {
      const collected: SalesOrder[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await getSalesOrdersPage({
          status: 'all',
          page,
          perPage: MENTION_PAGE_SIZE,
        });
        collected.push(...(result.items || []));
        totalPages = Math.max(1, Number(result.meta?.total_pages || 1));
        page += 1;
      } while (page <= totalPages);

      return collected.sort(compareNewestFirst);
    })();
  }

  try {
    return await cachedSalesOrdersPromise;
  } catch (error) {
    cachedSalesOrdersPromise = null;
    throw error;
  }
};

const loadAllOrderSlips = async (): Promise<OrderSlip[]> => {
  if (!cachedOrderSlipsPromise) {
    cachedOrderSlipsPromise = (async () => {
      const collected: OrderSlip[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await getOrderSlipsPage({
          status: 'all',
          page,
          perPage: MENTION_PAGE_SIZE,
        });
        collected.push(...(result.items || []));
        totalPages = Math.max(1, Number(result.meta?.total_pages || 1));
        page += 1;
      } while (page <= totalPages);

      return collected.sort(compareNewestFirst);
    })();
  }

  try {
    return await cachedOrderSlipsPromise;
  } catch (error) {
    cachedOrderSlipsPromise = null;
    throw error;
  }
};

const toSortableTimestamp = (value: string | undefined): number => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareNewestFirst = (
  left: { created_at?: string; sent_at?: string; sales_date?: string; id?: string },
  right: { created_at?: string; sent_at?: string; sales_date?: string; id?: string }
) => {
  const leftTime =
    toSortableTimestamp(left.created_at) ||
    toSortableTimestamp(left.sent_at) ||
    toSortableTimestamp(left.sales_date);
  const rightTime =
    toSortableTimestamp(right.created_at) ||
    toSortableTimestamp(right.sent_at) ||
    toSortableTimestamp(right.sales_date);

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.id || '').localeCompare(String(left.id || ''), undefined, { numeric: true });
};

const loadAllInvoices = async (): Promise<Invoice[]> => {
  if (!cachedInvoicesPromise) {
    cachedInvoicesPromise = (async () => {
      const collected: Invoice[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await getInvoicesPage({
          status: 'all',
          page,
          perPage: MENTION_PAGE_SIZE,
        });
        collected.push(...(result.items || []));
        totalPages = Math.max(1, Number(result.meta?.total_pages || 1));
        page += 1;
      } while (page <= totalPages);

      return collected.sort(compareNewestFirst);
    })();
  }

  try {
    return await cachedInvoicesPromise;
  } catch (error) {
    cachedInvoicesPromise = null;
    throw error;
  }
};

const toEntitySuggestion = (
  entityType: ChatMentionEntityType,
  row: SalesInquiry | SalesOrder | OrderSlip | Invoice
): InternalChatEntityMentionSuggestion => {
  switch (entityType) {
    case 'sales-inquiry':
      return {
        entityType,
        entityId: row.id,
        label: `Sales Inquiry ${('inquiry_no' in row && row.inquiry_no) || row.id}`,
        subtitle:
          ('reference_no' in row && row.reference_no?.trim()) ||
          ('customer_reference' in row && row.customer_reference?.trim()) ||
          ('remarks' in row && row.remarks?.trim()) ||
          ('sales_date' in row && row.sales_date?.trim()) ||
          'Open sales inquiry',
      };
    case 'sales-order':
      return {
        entityType,
        entityId: row.id,
        label: `Sales Order ${('order_no' in row && row.order_no) || row.id}`,
        subtitle:
          ('customer_reference' in row && row.customer_reference?.trim()) ||
          ('reference_no' in row && row.reference_no?.trim()) ||
          ('remarks' in row && row.remarks?.trim()) ||
          ('sales_date' in row && row.sales_date?.trim()) ||
          'Open sales order',
      };
    case 'order-slip':
      return {
        entityType,
        entityId: row.id,
        label: `Order Slip ${('slip_no' in row && row.slip_no) || row.id}`,
        subtitle:
          ('customer_name' in row && row.customer_name?.trim()) ||
          ('reference_no' in row && row.reference_no?.trim()) ||
          ('remarks' in row && row.remarks?.trim()) ||
          ('sales_date' in row && row.sales_date?.trim()) ||
          'Open order slip',
      };
    case 'invoice':
      return {
        entityType,
        entityId: row.id,
        label: `Invoice ${('invoice_no' in row && row.invoice_no) || row.id}`,
        subtitle:
          ('customer_reference' in row && row.customer_reference?.trim()) ||
          ('reference_no' in row && row.reference_no?.trim()) ||
          ('remarks' in row && row.remarks?.trim()) ||
          ('sales_date' in row && row.sales_date?.trim()) ||
          'Open invoice',
      };
    default:
      return {
        entityType,
        entityId: row.id,
        label: row.id,
        subtitle: '',
      };
  }
};

const filterScopedRecords = (
  entityType: Exclude<ChatMentionEntityType, 'product'>,
  rows: Array<SalesInquiry | SalesOrder | OrderSlip | Invoice>,
  needle: string
) =>
  rows
    .filter((row) => {
      if (!needle) return true;

      switch (entityType) {
        case 'sales-inquiry':
          return matchesNeedle(
            needle,
            'inquiry_no' in row ? row.inquiry_no : '',
            'reference_no' in row ? row.reference_no : '',
            'customer_reference' in row ? row.customer_reference : '',
            'remarks' in row ? row.remarks : '',
            'sales_person' in row ? row.sales_person : ''
          );
        case 'sales-order':
          return matchesNeedle(
            needle,
            'order_no' in row ? row.order_no : '',
            'reference_no' in row ? row.reference_no : '',
            'customer_reference' in row ? row.customer_reference : '',
            'remarks' in row ? row.remarks : '',
            'sales_person' in row ? row.sales_person : ''
          );
        case 'order-slip':
          return matchesNeedle(
            needle,
            'slip_no' in row ? row.slip_no : '',
            'customer_name' in row ? row.customer_name : '',
            'reference_no' in row ? row.reference_no : '',
            'remarks' in row ? row.remarks : '',
            'sales_person' in row ? row.sales_person : ''
          );
        case 'invoice':
          return matchesNeedle(
            needle,
            'invoice_no' in row ? row.invoice_no : '',
            'reference_no' in row ? row.reference_no : '',
            'customer_reference' in row ? row.customer_reference : '',
            'remarks' in row ? row.remarks : '',
            'sales_person' in row ? row.sales_person : ''
          );
      }
    })
    .map((row) => toEntitySuggestion(entityType, row));

export const preloadInternalChatMentionCaches = async (
  entityTypes: ChatMentionEntityType[] = ['sales-inquiry', 'sales-order', 'order-slip', 'invoice']
): Promise<void> => {
  const requestedTypes = new Set(entityTypes);
  await Promise.allSettled([
    requestedTypes.has('sales-inquiry') ? loadSalesInquiries() : Promise.resolve([]),
    requestedTypes.has('sales-order') ? loadAllSalesOrders() : Promise.resolve([]),
    requestedTypes.has('order-slip') ? loadAllOrderSlips() : Promise.resolve([]),
    requestedTypes.has('invoice') ? loadAllInvoices() : Promise.resolve([]),
  ]);
};

export const searchInternalChatEntityMentions = async (
  query: string,
  options: SearchInternalChatEntityMentionOptions = {}
): Promise<InternalChatEntityMentionSuggestion[]> => {
  const needle = searchNeedle(query);
  const requestedTypes = new Set(options.entityTypes || []);
  const shouldInclude = (entityType: ChatMentionEntityType) =>
    requestedTypes.size === 0 || requestedTypes.has(entityType);
  const invoiceOnlyMode = requestedTypes.size === 1 && requestedTypes.has('invoice');
  const salesInquiryOnlyMode = requestedTypes.size === 1 && requestedTypes.has('sales-inquiry');
  const salesOrderOnlyMode = requestedTypes.size === 1 && requestedTypes.has('sales-order');
  const orderSlipOnlyMode = requestedTypes.size === 1 && requestedTypes.has('order-slip');

  if (salesInquiryOnlyMode) {
    const inquiries = await loadSalesInquiries();
    return filterScopedRecords('sales-inquiry', inquiries.sort(compareNewestFirst), needle);
  }

  if (salesOrderOnlyMode) {
    const orders = await loadAllSalesOrders();
    return filterScopedRecords('sales-order', orders, needle);
  }

  if (orderSlipOnlyMode) {
    const slips = await loadAllOrderSlips();
    return filterScopedRecords('order-slip', slips, needle);
  }

  if (invoiceOnlyMode) {
    const invoices = await loadAllInvoices();
    return filterScopedRecords('invoice', invoices, needle);
  }

  const [inquiriesResult, ordersResult, orderSlipsResult, invoicesResult, productsResult] =
    await Promise.allSettled([
      shouldInclude('sales-inquiry') ? loadSalesInquiries() : Promise.resolve([]),
      shouldInclude('sales-order')
        ? getSalesOrdersPage({ search: query, status: 'all', page: 1, perPage: MAX_SUGGESTIONS_PER_GROUP })
        : Promise.resolve({ items: [] }),
      shouldInclude('order-slip')
        ? getOrderSlipsPage({ search: query, status: 'all', page: 1, perPage: MAX_SUGGESTIONS_PER_GROUP })
        : Promise.resolve({ items: [] }),
      shouldInclude('invoice')
        ? getInvoicesPage({ search: query, status: 'all', page: 1, perPage: MAX_SUGGESTIONS_PER_GROUP })
        : Promise.resolve({ items: [] }),
      shouldInclude('product') ? searchProducts(query, 'all') : Promise.resolve([]),
    ]);

  const suggestions: InternalChatEntityMentionSuggestion[] = [];

  if (inquiriesResult.status === 'fulfilled') {
    suggestions.push(
      ...limitResults(
        inquiriesResult.value
          .filter((inquiry) =>
            !needle ||
            matchesNeedle(
              needle,
              inquiry.inquiry_no,
              inquiry.reference_no,
              inquiry.customer_reference,
              inquiry.remarks
            )
          )
          .map((inquiry) => ({
            ...toEntitySuggestion('sales-inquiry', inquiry),
          }))
      )
    );
  }

  if (ordersResult.status === 'fulfilled') {
    suggestions.push(
      ...limitResults(
        (ordersResult.value.items || []).map((order) => ({
          ...toEntitySuggestion('sales-order', order),
        }))
      )
    );
  }

  if (orderSlipsResult.status === 'fulfilled') {
    suggestions.push(
      ...limitResults(
        (orderSlipsResult.value.items || []).map((slip) => ({
          ...toEntitySuggestion('order-slip', slip),
        }))
      )
    );
  }

  if (invoicesResult.status === 'fulfilled') {
    suggestions.push(
      ...limitResults(
        (invoicesResult.value.items || []).map((invoice) => ({
          ...toEntitySuggestion('invoice', invoice),
        }))
      )
    );
  }

  if (productsResult.status === 'fulfilled') {
    suggestions.push(
      ...limitResults(
        productsResult.value.map((product) => ({
          entityType: 'product' as const,
          entityId: product.id,
          label: `Product ${product.part_no || product.item_code || product.id}`,
          subtitle: [product.item_code, product.description].filter(Boolean).join(' • ') || 'Open product',
        }))
      )
    );
  }

  return suggestions;
};
