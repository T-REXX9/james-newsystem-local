import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProspectTeamOptions } from '../teamLocalApiService';

describe('prospect team options', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads the team dropdown options from the prospect creation endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { items: [{ id: 7, name: 'North Team' }] } }),
    } as Response);

    await expect(fetchProspectTeamOptions()).resolves.toEqual([{ id: 7, name: 'North Team' }]);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/prospect-team-options?');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('main_id=');
  });
});
