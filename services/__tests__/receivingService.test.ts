import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ context: { user: { id: 7 } } }),
}));

const okResponse = (data: unknown) => Promise.resolve({
  ok: true,
  json: async () => ({ ok: true, data }),
} as Response);

describe('receivingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('loads only active products for new receiving item choices', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({ items: [], meta: { page: 1, total_pages: 1 } })
    );

    const { receivingService } = await import('../receivingService');
    await receivingService.getProducts();

    expect(String((global.fetch as any).mock.calls[0][0])).toContain('status=active');
  });
});
