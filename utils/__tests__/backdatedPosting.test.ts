import { describe, expect, it } from 'vitest';
import {
  canMutateDocumentDateField,
  hasBackdatedPostingPermission,
  setBackdatedPostingPermission,
  validateDocumentDateWrite,
} from '../backdatedPosting';
import { isMasterUserAccount } from '../../constants';

describe('Backdated posting permission', () => {
  it('defaults off for staff and is account-wide', () => {
    const staff = { role: 'Sales Agent', action_permissions: { global: { can_edit: true }, pages: {} } };
    expect(hasBackdatedPostingPermission(staff)).toBe(false);
    expect(hasBackdatedPostingPermission({
      ...staff,
      action_permissions: setBackdatedPostingPermission(staff.action_permissions, true),
    })).toBe(true);
  });

  it('lets the Master User bypass Backdated posting restrictions', () => {
    const master = { role: 'Company Owner', user_type: '1', action_permissions: { can_backdate: false } };
    expect(isMasterUserAccount(master)).toBe(true);
    expect(hasBackdatedPostingPermission(master)).toBe(true);
  });
});

describe('canMutateDocumentDateField', () => {
  it('requires Edit, Backdated posting, and an unposted document', () => {
    expect(canMutateDocumentDateField({ canEdit: true, hasBackdatedPosting: true, isPosted: false })).toBe(true);
    expect(canMutateDocumentDateField({ canEdit: false, hasBackdatedPosting: true, isPosted: false })).toBe(false);
    expect(canMutateDocumentDateField({ canEdit: true, hasBackdatedPosting: false, isPosted: false })).toBe(false);
    expect(canMutateDocumentDateField({ canEdit: true, hasBackdatedPosting: true, isPosted: true })).toBe(false);
  });
});

describe('validateDocumentDateWrite', () => {
  const today = '2026-09-12';

  it('allows leaving an existing past date unchanged without permission', () => {
    expect(validateDocumentDateWrite({
      hasBackdatedPosting: false,
      proposedYmd: '2026-09-10',
      previousYmd: '2026-09-10',
      todayYmd: today,
    })).toEqual({ ok: true });
  });

  it('rejects changing into a past date without permission', () => {
    const result = validateDocumentDateWrite({
      hasBackdatedPosting: false,
      proposedYmd: '2026-09-10',
      previousYmd: today,
      todayYmd: today,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects changing an existing past date without permission', () => {
    const result = validateDocumentDateWrite({
      hasBackdatedPosting: false,
      proposedYmd: today,
      previousYmd: '2026-09-10',
      todayYmd: today,
    });
    expect(result.ok).toBe(false);
  });

  it('allows today without permission on create', () => {
    expect(validateDocumentDateWrite({
      hasBackdatedPosting: false,
      proposedYmd: today,
      previousYmd: null,
      todayYmd: today,
    })).toEqual({ ok: true });
  });

  it('allows past dates with Backdated posting and rejects future dates always', () => {
    expect(validateDocumentDateWrite({
      hasBackdatedPosting: true,
      proposedYmd: '2026-09-01',
      previousYmd: today,
      todayYmd: today,
    })).toEqual({ ok: true });
    const future = validateDocumentDateWrite({
      hasBackdatedPosting: true,
      proposedYmd: '2026-09-20',
      previousYmd: today,
      todayYmd: today,
    });
    expect(future.ok).toBe(false);
  });
});
