import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyCollectionService } from '../dailyCollectionService';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ token: 'test-token', context: { user: { id: 1 } } }),
}));

const okResponse = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve({ ok: true, data }),
}) as Response;

describe('dailyCollectionService payment types', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores a legacy TT payment after saving it as Check with no check number', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({
      items: [
        { lid: 1, ltype: 'Check', lchk_no: '', lamt: 150 },
        { lid: 2, ltype: 'Check', lchk_no: '123456', lamt: 200 },
      ],
    }));

    const items = await dailyCollectionService.getCollectionItems('DCR-1');

    expect(items[0]?.ltype).toBe('TT');
    expect(items[1]?.ltype).toBe('Check');
  });
});
