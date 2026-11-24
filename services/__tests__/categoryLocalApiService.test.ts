import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCategories } from '../categoryLocalApiService';

describe('fetchCategories', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bypasses cached category lists so product forms receive recent edits', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { items: [{ id: 1, name: 'Updated category' }], meta: {} } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCategories();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/categories?'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(result.items).toEqual([{ id: 1, name: 'Updated category' }]);
  });
});
