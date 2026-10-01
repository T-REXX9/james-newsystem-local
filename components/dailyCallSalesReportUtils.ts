import { navigateWorkflow } from '../utils/workflowNavigate';

export interface DailyCallSalesReportProductLine {
  name: string;
  quantity: number;
  price: number;
  remark: string;
  partNo: string;
  itemCode: string;
  description: string;
  location: string;
  brand: string;
}

export interface DailyCallSalesReportRecord {
  id: string;
  inquiryId: string;
  inquiryNo: string;
  date: string;
  time: string;
  sales_agent: string;
  notes?: string;
  total_amount: number;
  approval_status: 'approved' | 'pending' | 'rejected' | string;
  products: DailyCallSalesReportProductLine[];
}

export const normalizeDateValue = (value: string): string => {
  const trimmed = value.trim();
  const directMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeProductName = (value: string): string => value.trim().toLowerCase();

export const normalizeSalesReportRecords = (data: unknown): DailyCallSalesReportRecord[] =>
  Array.isArray(data)
    ? data.map((rawReport: Partial<DailyCallSalesReportRecord>) => {
        const report = rawReport as any;
        const products = Array.isArray(report.products) ? report.products : Array.isArray(report.items) ? report.items : [];
        return {
          id: String(report.id || report.inquiry_id || ''),
          inquiryId: String(report.inquiry_id || report.id || ''),
          inquiryNo: String(report.inquiryNo || report.inquiry_no || ''),
          date: String(report.date || report.sales_date || ''),
          time: String(report.time || report.sales_time || ''),
          sales_agent: String(report.sales_agent || report.sales_person || ''),
          notes: String(report.notes || report.remarks || ''),
          total_amount: Number(report.total_amount || report.grand_total || 0),
          approval_status: String(report.approval_status || report.status || 'pending'),
          products: products.map((product: any) => ({
            name: String(product.name || product.product_name || product.description || ''),
            quantity: Number(product.quantity || product.qty || 0),
            price: Number(product.price || product.unit_price || 0),
            remark: String(product.remark || ''),
            partNo: String(product.partNo || product.part_no || ''),
            itemCode: String(product.itemCode || product.item_code || ''),
            description: String(product.description || product.name || ''),
            location: String(product.location || ''),
            brand: String(product.brand || ''),
          })),
        };
      })
    : [];

export const openDailyCallSalesInquiry = (contactId: string, inquiryId: string) => {
  if (!inquiryId) return;

  navigateWorkflow('sales-transaction-sales-inquiry', {
    inquiryId,
    contactId,
    prefillToken: Date.now().toString(),
    openMode: 'existing',
  });
};
