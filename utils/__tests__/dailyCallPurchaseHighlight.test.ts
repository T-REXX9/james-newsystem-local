import { describe, expect, it } from 'vitest';
import { resolveDailyCallPurchaseHighlightColor } from '../dailyCallPurchaseHighlight';

describe('resolveDailyCallPurchaseHighlightColor', () => {
  const referenceDate = new Date(2026, 8, 22); // Sep 22, 2026

  it('marks unverified / no-purchase prospects white even when monthsSince is 0', () => {
    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '',
      monthsSinceLastPurchase: 0,
      currentMonthSales: 0,
      purchaseAgeGroup: 'no_purchase',
      purchaseCount: 0,
      referenceDate,
    })).toBe('white');

    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: null,
      monthsSinceLastPurchase: 0,
      currentMonthSales: 0,
      purchaseCount: 0,
      referenceDate,
    })).toBe('white');
  });

  it('marks current-month buyers green', () => {
    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-09-10',
      monthsSinceLastPurchase: 0,
      currentMonthSales: 5000,
      purchaseAgeGroup: 'recent',
      purchaseCount: 2,
      referenceDate,
    })).toBe('green');
  });

  it('is NOT green when current-month sales are 0 even if last purchase is this month', () => {
    // Regression: ledger date this month (payment/return/adjustment) with ₱0 posted
    // sales must not force green. This is the JIMSCO / GREG case from the Priority List.
    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-09-25',
      monthsSinceLastPurchase: 0,
      currentMonthSales: 0,
      purchaseAgeGroup: 'recent',
      purchaseCount: 3,
      referenceDate,
    })).not.toBe('green');

    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-09-25',
      monthsSinceLastPurchase: 0,
      currentMonthSales: 0,
      purchaseAgeGroup: 'recent',
      purchaseCount: 3,
      referenceDate,
    })).toBe('yellow');
  });

  it('still greens a current-month last purchase when currentMonthSales is not supplied', () => {
    // Callers that cannot provide currentMonthSales (undefined) keep the date-based fallback.
    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-09-25',
      referenceDate,
    })).toBe('green');
  });

  it('maps 1 / 2 / 3+ months without purchase to yellow / purple / white', () => {
    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-08-15',
      monthsSinceLastPurchase: 1,
      currentMonthSales: 0,
      purchaseCount: 1,
      referenceDate,
    })).toBe('yellow');

    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-07-15',
      monthsSinceLastPurchase: 2,
      currentMonthSales: 0,
      purchaseCount: 1,
      referenceDate,
    })).toBe('purple');

    expect(resolveDailyCallPurchaseHighlightColor({
      lastPurchaseDateRaw: '2026-05-15',
      monthsSinceLastPurchase: 4,
      currentMonthSales: 0,
      purchaseCount: 1,
      referenceDate,
    })).toBe('white');
  });

  it('marks blocked customers red before purchase age', () => {
    expect(resolveDailyCallPurchaseHighlightColor({
      isBlocked: true,
      lastPurchaseDateRaw: '2026-09-10',
      currentMonthSales: 9000,
      purchaseCount: 3,
      referenceDate,
    })).toBe('red');
  });
});
