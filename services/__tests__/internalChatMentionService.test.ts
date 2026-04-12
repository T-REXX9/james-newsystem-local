import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoiceMocks = vi.hoisted(() => ({
  getInvoicesPage: vi.fn(),
}));

vi.mock('../invoiceLocalApiService', () => ({
  getInvoicesPage: (...args: any[]) => invoiceMocks.getInvoicesPage(...args),
}));

vi.mock('../productLocalApiService', () => ({
  searchProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../salesInquiryLocalApiService', () => ({
  getAllSalesInquiries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../salesOrderLocalApiService', () => ({
  getSalesOrdersPage: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../orderSlipLocalApiService', () => ({
  getOrderSlipsPage: vi.fn().mockResolvedValue({ items: [] }),
}));

describe('internalChatMentionService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns scoped invoice mentions newest-first and filters locally as the user types', async () => {
    invoiceMocks.getInvoicesPage
      .mockResolvedValueOnce({
        items: [
          {
            id: 'inv-1',
            invoice_no: 'INV-001',
            customer_reference: 'Alpha',
            reference_no: '',
            remarks: '',
            sales_person: 'Melson',
            sales_date: '2026-04-10',
            created_at: '2026-04-10T08:00:00.000Z',
          },
        ],
        meta: { total_pages: 2 },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'inv-3',
            invoice_no: 'INV-003',
            customer_reference: 'Gamma',
            reference_no: '',
            remarks: '',
            sales_person: 'Melson',
            sales_date: '2026-04-12',
            created_at: '2026-04-12T08:00:00.000Z',
          },
          {
            id: 'inv-2',
            invoice_no: 'INV-002',
            customer_reference: 'Beta',
            reference_no: '',
            remarks: '',
            sales_person: 'Melson',
            sales_date: '2026-04-11',
            created_at: '2026-04-11T08:00:00.000Z',
          },
        ],
        meta: { total_pages: 2 },
      });

    const { searchInternalChatEntityMentions } = await import('../internalChatMentionService');

    const allInvoices = await searchInternalChatEntityMentions('', {
      entityTypes: ['invoice'],
    });

    expect(allInvoices.map((item) => item.label)).toEqual([
      'Invoice INV-003',
      'Invoice INV-002',
      'Invoice INV-001',
    ]);

    const filtered = await searchInternalChatEntityMentions('002', {
      entityTypes: ['invoice'],
    });

    expect(filtered.map((item) => item.label)).toEqual(['Invoice INV-002']);
    expect(invoiceMocks.getInvoicesPage).toHaveBeenCalledTimes(2);
  });

  it('can preload invoice mention records so later scoped searches reuse the warmed cache', async () => {
    invoiceMocks.getInvoicesPage.mockResolvedValue({
      items: [
        {
          id: 'inv-9',
          invoice_no: 'INV-009',
          customer_reference: 'Warm cache',
          reference_no: '',
          remarks: '',
          sales_person: 'Melson',
          sales_date: '2026-04-12',
          created_at: '2026-04-12T09:00:00.000Z',
        },
      ],
      meta: { total_pages: 1 },
    });

    const { preloadInternalChatMentionCaches, searchInternalChatEntityMentions } = await import('../internalChatMentionService');

    await preloadInternalChatMentionCaches(['invoice']);
    const results = await searchInternalChatEntityMentions('009', {
      entityTypes: ['invoice'],
    });

    expect(results.map((item) => item.label)).toEqual(['Invoice INV-009']);
    expect(invoiceMocks.getInvoicesPage).toHaveBeenCalledTimes(1);
  });
});
