import { describe, expect, it } from 'vitest';
import { CustomerStatus } from '../../types';
import { isBlockedContact, isBlockedDailyCallMasterRow } from '../dailyCallBlockedCustomer';

describe('dailyCallBlockedCustomer', () => {
  it('detects blocked master rows by status or debt type', () => {
    expect(isBlockedDailyCallMasterRow({ customerStatus: 4, debtType: 'Good' })).toBe(true);
    expect(isBlockedDailyCallMasterRow({ customerStatus: 1, debtType: 'Bad' })).toBe(true);
    expect(isBlockedDailyCallMasterRow({ customerStatus: 1, debtType: 'Good' })).toBe(false);
  });

  it('detects blocked contacts by status or debt type', () => {
    expect(isBlockedContact({ status: CustomerStatus.BLACKLISTED, debtType: 'Good' })).toBe(true);
    expect(isBlockedContact({ status: CustomerStatus.ACTIVE, debtType: 'Bad' })).toBe(true);
    expect(isBlockedContact({ status: CustomerStatus.ACTIVE, debtType: 'Good' })).toBe(false);
  });
});
