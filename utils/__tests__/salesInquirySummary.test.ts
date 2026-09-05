import { describe, expect, it } from 'vitest';
import { DEFAULT_VIP_TIER_CONFIG } from '../vipTierConfig';
import { buildSalesInquiryCustomerSummary } from '../salesInquirySummary';

const selectedInput = {
  selected: true,
  ishinomotoSales: 125000,
  currentMonthSales: 2500,
  customerSince: '2019-03-01',
  creditLimit: 50000,
  terms: '30 days',
  balance: 12000,
  preferredBrand: 'Ishinomoto',
  monthLabel: 'September',
  vipConfig: DEFAULT_VIP_TIER_CONFIG,
};

const labelsOf = (input: Parameters<typeof buildSalesInquiryCustomerSummary>[0]) =>
  buildSalesInquiryCustomerSummary(input).map((cell) => cell.label);

describe('buildSalesInquiryCustomerSummary', () => {
  const cell = (label: string, input = selectedInput) =>
    buildSalesInquiryCustomerSummary(input).find((entry) => entry.label === label);

  it('uses the Sales Inquiry summary columns in order', () => {
    expect(labelsOf(selectedInput)).toEqual([
      'Ishinomoto Sales',
      'VIP Silver remaining',
      'VIP Gold remaining',
      'Total Sales for September',
      'Customer Since',
      'Credit Limit',
      'Terms',
      'Balance',
      'Preferred Brand',
    ]);
  });

  it('shows how much more this month is needed to reach VIP Silver and VIP Gold', () => {
    expect(cell('VIP Silver remaining')?.value).toBe(7500);
    expect(cell('VIP Gold remaining')?.value).toBe(27500);
  });

  it('shows 0 remaining when this month already meets a VIP threshold', () => {
    const atGold = {
      ...selectedInput,
      currentMonthSales: 40000,
    };
    expect(cell('VIP Silver remaining', atGold)?.value).toBe(0);
    expect(cell('VIP Gold remaining', atGold)?.value).toBe(0);
  });

  it('uses VIP Thresholds instead of hardcoded 10000 and 30000', () => {
    const custom = {
      ...selectedInput,
      currentMonthSales: 2000,
      vipConfig: {
        one_time_discount_threshold: 8000,
        unlimited_discount_threshold: 22000,
        discount_percentage: 10,
      },
    };
    expect(cell('VIP Silver remaining', custom)?.value).toBe(6000);
    expect(cell('VIP Gold remaining', custom)?.value).toBe(20000);
  });

  it('leaves sales and remaining empty when no customer is selected', () => {
    const empty = buildSalesInquiryCustomerSummary({
      ...selectedInput,
      selected: false,
    });
    expect(cell('Ishinomoto Sales', { ...selectedInput, selected: false })?.value).toBeNull();
    expect(cell('VIP Silver remaining', { ...selectedInput, selected: false })?.value).toBeNull();
    expect(cell('VIP Gold remaining', { ...selectedInput, selected: false })?.value).toBeNull();
    expect(cell('Total Sales for September', { ...selectedInput, selected: false })?.value).toBeNull();
    expect(empty.find((entry) => entry.label === 'Credit Limit')?.value).toBe(50000);
  });

  it('fills Ishinomoto Sales and the kept customer metrics', () => {
    expect(cell('Ishinomoto Sales')?.value).toBe(125000);
    expect(cell('Total Sales for September')?.value).toBe(2500);
    expect(cell('Customer Since')?.value).toBe('2019-03-01');
    expect(cell('Credit Limit')?.value).toBe(50000);
    expect(cell('Terms')?.value).toBe('30 days');
    expect(cell('Balance')?.value).toBe(12000);
    expect(cell('Preferred Brand')?.value).toBe('Ishinomoto');
  });
});
