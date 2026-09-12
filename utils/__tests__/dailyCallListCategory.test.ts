import { describe, expect, it } from 'vitest';
import {
  matchesDailyCallMonitorBucket,
  resolveDailyCallListCategory,
  resolveDailyCallMonitorBucket,
} from '../dailyCallListCategory';

describe('dailyCallListCategory', () => {
  it('classifies Oct 2025+ ledger activity as Priority and earlier as Recovery', () => {
    expect(resolveDailyCallListCategory({
      priorityTransactionCount: 2,
      ledgerTransactionCount: 5,
      purchaseCount: 5,
      lastPurchaseDateRaw: '2025-11-01',
    })).toBe('priority');

    expect(resolveDailyCallListCategory({
      priorityTransactionCount: 0,
      ledgerTransactionCount: 4,
      purchaseCount: 4,
      lastPurchaseDateRaw: '2025-09-15',
    })).toBe('recovery');
  });

  it('never promotes purchaseCount alone into Priority when listCategory is missing', () => {
    expect(resolveDailyCallListCategory({
      purchaseCount: 5,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 5,
      lastPurchaseDateRaw: '2025-09-10',
    })).toBe('recovery');
  });

  it('keeps pre-Oct buyers in Recovery even when profile is still Verified Prospective', () => {
    const row = {
      profileType: 'Prospective',
      verification: 'Verified',
      customerStatus: 3,
      purchaseCount: 2,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 2,
      lastPurchaseDateRaw: '2025-08-01',
      listCategory: 'no_purchase' as const,
    };

    expect(resolveDailyCallMonitorBucket(row)).toBe('recovery');
    expect(matchesDailyCallMonitorBucket(row, 'verified')).toBe(false);
  });

  it('uses lastPurchaseDateRaw before Oct 2025 as Recovery even when counts are zero', () => {
    const row = {
      profileType: 'Prospect',
      verification: 'Verified',
      customerStatus: 3,
      purchaseCount: 0,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 0,
      lastPurchaseDateRaw: '2025-09-20',
      listCategory: 'no_purchase' as const,
    };

    expect(resolveDailyCallListCategory(row)).toBe('recovery');
    expect(resolveDailyCallMonitorBucket(row)).toBe('recovery');
    expect(matchesDailyCallMonitorBucket(row, 'verified')).toBe(false);
  });

  it('moves a former verified prospect into Priority after the first purchase', () => {
    expect(resolveDailyCallMonitorBucket({
      profileType: 'Prospect',
      verification: 'Verified',
      purchaseCount: 1,
      priorityTransactionCount: 1,
      ledgerTransactionCount: 1,
      lastPurchaseDateRaw: '2026-09-05',
      listCategory: 'no_purchase',
    })).toBe('priority');
  });

  it('keeps no-purchase prospects in Verified / Unverified for approval', () => {
    expect(resolveDailyCallMonitorBucket({
      profileType: 'Prospect',
      verification: 'Unverified',
      customerStatus: 3,
      purchaseCount: 0,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 0,
      lastPurchaseDateRaw: '',
      listCategory: 'no_purchase',
    })).toBe('unverified');

    expect(resolveDailyCallMonitorBucket({
      profileType: 'Prospect',
      verification: 'Verified',
      customerStatus: 3,
      purchaseCount: 0,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 0,
      lastPurchaseDateRaw: '',
      listCategory: 'no_purchase',
    })).toBe('verified');
  });

  it('keeps Active customer records out of Verified Prospects even with leftover Verified flags', () => {
    expect(resolveDailyCallMonitorBucket({
      profileType: 'Prospective',
      verification: 'Verified',
      customerStatus: 1,
      purchaseCount: 0,
      priorityTransactionCount: 0,
      ledgerTransactionCount: 0,
      lastPurchaseDateRaw: '',
      listCategory: 'no_purchase',
    })).toBeNull();
  });
});
