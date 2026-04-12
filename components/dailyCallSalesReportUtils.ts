export interface DailyCallSalesReportProductLine {
  name: string;
  quantity: number;
  price: number;
  remark: string;
  partNo: string;
  itemCode: string;
  description: string;
}

export interface DailyCallSalesReportRecord {
  id: string;
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
    ? data.map((report: Partial<DailyCallSalesReportRecord>) => ({
        id: String(report.id || ''),
        date: String(report.date || ''),
        time: String(report.time || ''),
        sales_agent: String(report.sales_agent || ''),
        notes: typeof report.notes === 'string' ? report.notes : '',
        total_amount: Number(report.total_amount || 0),
        approval_status: String(report.approval_status || 'pending'),
        products: Array.isArray(report.products)
          ? report.products.map((product: Partial<DailyCallSalesReportProductLine>) => ({
              name: String(product.name || ''),
              quantity: Number(product.quantity || 0),
              price: Number(product.price || 0),
              remark: String(product.remark || ''),
              partNo: String(product.partNo || ''),
              itemCode: String(product.itemCode || ''),
              description: String(product.description || ''),
            }))
          : [],
      }))
    : [];

export const openDailyCallSalesInquiry = (contactId: string, inquiryId: string) => {
  if (!inquiryId) return;

  window.dispatchEvent(new CustomEvent('workflow:navigate', {
    detail: {
      tab: 'salesinquiry',
      payload: {
        inquiryId,
        contactId,
        prefillToken: Date.now().toString(),
        openMode: 'existing',
      },
    },
  }));
};
