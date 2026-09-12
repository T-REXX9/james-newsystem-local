import { requestLocalApi } from './localApiClient';

export type SalesDocumentDateCascadePayload = {
  sales_date: string;
  inquiry_refno?: string;
  sales_order_refno?: string;
  order_slip_refno?: string;
  invoice_refno?: string;
};

export async function cascadeSalesDocumentDate(
  payload: SalesDocumentDateCascadePayload
): Promise<{ updated: boolean; sales_date: string }> {
  return requestLocalApi('/sales-documents/cascade-date', 'POST', payload);
}
