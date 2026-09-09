import { describe, expect, it, vi } from 'vitest';
import { canPerformAction } from '../actionPermissions';
import { hasActionPermission } from '../../constants';
import { getLocalAuthSession } from '../../services/localAuthService';

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(),
}));

describe('canPerformAction', () => {
  it('uses the saved per-account action flag', () => {
    vi.mocked(getLocalAuthSession).mockReturnValue({
      userProfile: {
        id: '7',
        email: 'staff@example.com',
        role: 'Sales Agent',
        action_permissions: {
          can_add: true,
          can_edit: false,
          can_delete: true,
          can_post: false,
          can_unpost: false,
        },
      },
      token: 'token',
    } as any);

    expect(canPerformAction('can_edit')).toBe(false);
    expect(canPerformAction('can_post')).toBe(false);
  });

  it('lets the Master User bypass stored restrictions', () => {
    vi.mocked(getLocalAuthSession).mockReturnValue({
      userProfile: {
        id: '1',
        email: 'master@example.com',
        role: 'Company Owner',
        user_type: '1',
        action_permissions: { can_delete: false },
      },
      token: 'token',
    } as any);

    expect(canPerformAction('can_delete')).toBe(true);
  });

  it('isolates page action permissions', () => {
    const user = {
      role: 'Sales Agent',
      action_permissions: {
        global: { can_add: true, can_edit: true, can_delete: true, can_post: true, can_unpost: true },
        pages: {
          'Sales Inquiry': { can_delete: true },
          'Product Database': { can_delete: false },
        },
      },
    };

    expect(hasActionPermission(user, 'can_delete', 'Sales Inquiry')).toBe(true);
    expect(hasActionPermission(user, 'can_delete', 'Product Database')).toBe(false);
  });
});
