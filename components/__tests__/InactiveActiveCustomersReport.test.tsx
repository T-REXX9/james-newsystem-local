import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InactiveActiveCustomersReport from '../InactiveActiveCustomersReport';
import { fetchInactiveActiveCustomersReport } from '../../services/inactiveActiveCustomersReportService';
import { fetchDailyCallMasterList } from '../../services/dailyCallMonitoringService';
import { getVipTierConfig } from '../../services/vipTierSettingsService';
import { setCustomerStarred } from '../../services/customerDatabaseLocalApiService';

const authStarMocks = vi.hoisted(() => ({
  session: null as any,
  setCustomerStarred: vi.fn(),
}));

vi.mock('../../services/inactiveActiveCustomersReportService', () => ({ fetchInactiveActiveCustomersReport: vi.fn() }));
vi.mock('../../services/dailyCallMonitoringService', () => ({ fetchDailyCallMasterList: vi.fn() }));
vi.mock('../../services/vipTierSettingsService', () => ({ getVipTierConfig: vi.fn() }));
vi.mock('../../services/localAuthService', () => ({ getLocalAuthSession: () => authStarMocks.session }));
vi.mock('../../services/customerDatabaseLocalApiService', () => ({ setCustomerStarred: authStarMocks.setCustomerStarred }));

const reportRow = (id: string, customerStatus: 'active' | 'inactive') => ({
  id, customerName: `${id} customer`, customerCode: `${id}-code`, customerGroup: 'old group',
  salesPerson: 'Agent One', lastPurchase: customerStatus === 'active' ? '2026-09-01' : '2026-01-03', customerStatus,
  vipStatus: '', latestSalesReportMessage: '', latestSalesReportAuthor: '', latestSalesReportAt: '',
  lastPurchaseRaw: '', isBlocked: false, purchaseAgeGroup: '', currentMonthSales: 0, lastMonthSales: 0,
  purchaseCount: 0, monthsSinceLastPurchase: 0, dailyCallColor: '',
});

const dailyCallRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, shopName: `${id} customer`, province: '', city: '', contactNumber: '', assignedTo: 'Agent One',
  customerStatus: 1, debtType: 'Good', latestSalesReportMessage: `Report for ${id}`,
  latestSalesReportAuthor: 'Agent One', latestSalesReportAt: '2026-09-30 16:42:17',
  lastPurchaseDate: 'Sep 01, 2026', lastPurchaseDateRaw: '2026-09-01', purchaseCount: 4,
  currentMonthSales: 1200, lastMonthSales: 12000, monthsSinceLastPurchase: 0, purchaseAgeGroup: 'recent',
  totalSales: 12000, averageMonthlySales: 0, averageMonthlySalesMonthCount: 0,
  recentThreeMonthSales: 0, previousThreeMonthSales: 0, salesTrendPercent: 0, daysSinceLastPurchase: 0,
  ...overrides,
}) as any;

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('InactiveActiveCustomersReport', () => {
  it('loads both status cohorts by default and shows VIP, exact dates, unified reports, and Daily Call colors', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: [
      dailyCallRow('active-1'),
      dailyCallRow('inactive-1', { customerStatus: 4, currentMonthSales: 0, lastPurchaseDateRaw: '2026-09-30', lastPurchaseDate: 'Sep 30, 2026', purchaseAgeGroup: 'recent' }),
    ], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 2 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => ({
      items: filters.status === 'active' ? [reportRow('active-1', 'active')] : [reportRow('inactive-1', 'inactive')],
      summary: { activeCount: 1, inactiveCount: 1, totalCount: 2, cutoffMonths: 3, cutoffDate: '2026-07-05' },
      meta: { page: filters.page, perPage: 300, total: 1, totalPages: 1, status: filters.status, search: '' },
    }));

    render(<InactiveActiveCustomersReport />);
    const activeName = await screen.findByText('active-1 customer');
    const inactiveName = await screen.findByText('inactive-1 customer');
    expect(within(activeName.closest('table')!).getByText('Active')).toBeTruthy();
    expect(within(inactiveName.closest('table')!).getByText('Inactive')).toBeTruthy();
    expect(screen.getAllByText('VIP Silver')).toHaveLength(2);
    expect(screen.getByText('Sep 01, 2026')).toBeTruthy();
    expect(screen.getByText('Jan 03, 2026')).toBeTruthy();
    expect(screen.getByText('Report for active-1')).toBeTruthy();
    expect(screen.getAllByText('2026-09-30 16:42:17')).toHaveLength(2);
    expect(activeName.closest('tr')?.className).toContain('bg-green-100');
    expect(inactiveName.closest('tr')?.className).toContain('bg-[#f94449]/20');
    expect(screen.getAllByRole('columnheader', { name: 'VIP Status' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Status' })).toHaveLength(2);
    expect(screen.queryByPlaceholderText(/search customer/i)).toBeNull();
    expect(fetchInactiveActiveCustomersReport).toHaveBeenCalledWith(expect.objectContaining({ yearFrom: null, yearTo: null, perPage: 300 }));
  });

  it('uses the selected year range and keeps a separate request for each cohort', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: [], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 0 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => ({
      items: [], summary: { activeCount: 0, inactiveCount: 0, totalCount: 0, cutoffMonths: 3, cutoffDate: '' },
      meta: { page: filters.page, perPage: 300, total: 0, totalPages: 0, status: filters.status, search: '' },
    }));
    render(<InactiveActiveCustomersReport />);
    fireEvent.change(screen.getByRole('combobox', { name: 'From year' }), { target: { value: '2024' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'To year' }), { target: { value: '2025' } });
    await waitFor(() => expect(fetchInactiveActiveCustomersReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive', yearFrom: 2024, yearTo: 2025 })));
    expect(fetchInactiveActiveCustomersReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', yearFrom: 2024, yearTo: 2025 }));
  });

  it('matches all VIP tiers and all five Daily Call color categories', async () => {
    const now = new Date();
    const dateInMonthOffset = (offset: number) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    };
    const ids = ['green-gold', 'yellow-silver', 'purple-regular', 'white-none', 'red-blocked'];
    const dailyCallRows = [
      dailyCallRow(ids[0], { lastMonthSales: 30000, currentMonthSales: 1, lastPurchaseDateRaw: dateInMonthOffset(0), purchaseAgeGroup: 'recent' }),
      dailyCallRow(ids[1], { lastMonthSales: 10000, currentMonthSales: 0, lastPurchaseDateRaw: dateInMonthOffset(-1), purchaseAgeGroup: 'over_one_month' }),
      dailyCallRow(ids[2], { lastMonthSales: 0, currentMonthSales: 0, lastPurchaseDateRaw: dateInMonthOffset(-2), purchaseAgeGroup: 'over_one_month' }),
      dailyCallRow(ids[3], { lastMonthSales: 0, currentMonthSales: 0, lastPurchaseDateRaw: '', purchaseAgeGroup: 'no_purchase', purchaseCount: 0 }),
      dailyCallRow(ids[4], { lastMonthSales: 0, currentMonthSales: 0, lastPurchaseDateRaw: dateInMonthOffset(-4), purchaseAgeGroup: 'over_one_month', customerStatus: 4 }),
    ];
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: dailyCallRows, pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: dailyCallRows.length } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => {
      const items = filters.status === 'active'
        ? ids.map((id) => reportRow(id, 'active'))
        : [];
      return {
        items,
        summary: { activeCount: items.length, inactiveCount: 0, totalCount: items.length, cutoffMonths: 3, cutoffDate: '' },
        meta: { page: filters.page, perPage: 300, total: items.length, totalPages: 1, status: filters.status, search: '' },
      };
    });

    render(<InactiveActiveCustomersReport />);

    const expected = [
      ['green-gold customer', 'VIP Gold', 'bg-green-100'],
      ['yellow-silver customer', 'VIP Silver', 'bg-yellow-100'],
      ['purple-regular customer', 'Regular', 'bg-purple-100'],
      ['white-none customer', 'Regular', 'bg-white'],
      ['red-blocked customer', 'Regular', 'bg-[#f94449]/20'],
    ] as const;
    for (const [name, vip, color] of expected) {
      const customer = await screen.findByText(name);
      const row = customer.closest('tr')!;
      expect(within(row).getByText(vip)).toBeTruthy();
      expect(row.className).toContain(color);
    }
  });

  it('loads independent page two for each cohort and exports rows from every page', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: [], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 0 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => {
      const row = reportRow(`${filters.status}-page-${filters.page}`, filters.status === 'active' ? 'active' : 'inactive');
      const total = filters.status === 'active' ? 301 : 601;
      return {
        items: [row], summary: { activeCount: 301, inactiveCount: 601, totalCount: 902, cutoffMonths: 3, cutoffDate: '' },
        meta: { page: filters.page, perPage: 300, total, totalPages: Math.ceil(total / 300), status: filters.status, search: '' },
      };
    });
    let exportedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => { exportedBlob = blob; return 'blob:test'; });
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    render(<InactiveActiveCustomersReport />);

    await screen.findByText('active-page-1 customer');
    let activeTable = screen.getByText('active-page-1 customer').closest('table')!;
    fireEvent.click(within(activeTable.parentElement!).getByRole('button', { name: 'Next' }));
    await screen.findByText('active-page-2 customer');
    const inactiveTable = screen.getByText('inactive-page-1 customer').closest('table')!;
    fireEvent.click(within(inactiveTable.parentElement!).getByRole('button', { name: 'Next' }));
    await screen.findByText('inactive-page-2 customer');
    expect(fetchInactiveActiveCustomersReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', page: 2 }));
    expect(fetchInactiveActiveCustomersReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive', page: 2 }));

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const exportRequests = vi.mocked(fetchInactiveActiveCustomersReport).mock.calls.slice(-5).map(([filters]) => [filters.status, filters.page]);
    expect(exportRequests).toContainEqual(['active', 2]);
    expect(exportRequests).toContainEqual(['inactive', 2]);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    const csvText = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(exportedBlob!);
    });
    expect(csvText).toContain('active-page-2 customer');
    expect(csvText).toContain('inactive-page-3 customer');
  });

  it('surfaces Daily Call load failures and retries the enrichment request', async () => {
    vi.mocked(fetchDailyCallMasterList)
      .mockRejectedValueOnce(new Error('Daily Call unavailable'))
      .mockResolvedValueOnce({ items: [], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 0 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockResolvedValue({
      items: [], summary: { activeCount: 0, inactiveCount: 0, totalCount: 0, cutoffMonths: 3, cutoffDate: '' },
      meta: { page: 1, perPage: 300, total: 0, totalPages: 0, status: 'active', search: '' },
    });
    render(<InactiveActiveCustomersReport />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Daily Call details could not be loaded/i);
    fireEvent.click(screen.getByRole('button', { name: 'Retry Daily Call data' }));
    await waitFor(() => expect(fetchDailyCallMasterList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('allows only a master user to toggle a customer star using the existing API mutation', async () => {
    authStarMocks.session = { userProfile: { id: '1', role: 'Owner', user_type: '1' } };
    authStarMocks.setCustomerStarred.mockResolvedValue(undefined);
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: [dailyCallRow('star-me', { isStarred: true })], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 1 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => ({
      items: filters.status === 'active' ? [reportRow('star-me', 'active')] : [],
      summary: { activeCount: 1, inactiveCount: 0, totalCount: 1, cutoffMonths: 3, cutoffDate: '' },
      meta: { page: 1, perPage: 300, total: filters.status === 'active' ? 1 : 0, totalPages: 1, status: filters.status, search: '' },
    }));

    render(<InactiveActiveCustomersReport />);
    const starButton = await screen.findByRole('button', { name: 'Remove star from star-me customer' });
    expect(starButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(starButton);
    await waitFor(() => expect(setCustomerStarred).toHaveBeenCalledWith('star-me', false));
    expect(await screen.findByRole('button', { name: 'Star star-me customer' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the star read-only for a non-master user', async () => {
    authStarMocks.session = { userProfile: { id: '2', role: 'Sales Agent', user_type: '2' } };
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({ items: [dailyCallRow('star-readonly', { isStarred: true })], pendingDuplicateProspects: [], meta: { fromDate: '2025-10-01', toDate: '', count: 1 } });
    vi.mocked(getVipTierConfig).mockResolvedValue({ one_time_discount_threshold: 10000, unlimited_discount_threshold: 30000, discount_percentage: 10 });
    vi.mocked(fetchInactiveActiveCustomersReport).mockImplementation(async (filters) => ({
      items: filters.status === 'active' ? [reportRow('star-readonly', 'active')] : [],
      summary: { activeCount: 1, inactiveCount: 0, totalCount: 1, cutoffMonths: 3, cutoffDate: '' },
      meta: { page: 1, perPage: 300, total: filters.status === 'active' ? 1 : 0, totalPages: 1, status: filters.status, search: '' },
    }));

    render(<InactiveActiveCustomersReport />);
    expect(await screen.findByLabelText('Starred customer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /star star-readonly customer/i })).toBeNull();
    expect(setCustomerStarred).not.toHaveBeenCalled();
  });
});
