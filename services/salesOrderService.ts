/** Compatibility entry point. All operations use the local MySQL API. */
export * from './salesOrderLocalApiService';
export { convertToOrder as createFromInquiry } from './salesInquiryLocalApiService';
import { requestLocalApi } from './localApiClient';
export async function deleteSalesOrder(id: string): Promise<boolean> {
  await requestLocalApi(`/sales-orders/${encodeURIComponent(id)}`, 'DELETE');
  return true;
}
