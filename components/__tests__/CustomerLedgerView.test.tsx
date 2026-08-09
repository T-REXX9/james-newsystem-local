import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CustomerLedgerView from '../CustomerLedgerView';

// Mock the service
const mockGetCustomers = vi.fn();
const mockGetLedger = vi.fn();
const mockExportLedgerCsv = vi.fn();

vi.mock('../../services/customerLedgerService', () => ({
  customerLedgerService: {
    getCustomers: (...args: any[]) => mockGetCustomers(...args),
    getLedger: (...args: any[]) => mockGetLedger(...args),
    exportLedgerCsv: (...args: any[]) => mockExportLedgerCsv(...args),
  },
}));

const mockCustomers = [
  { sessionId: 'cust-1', customerCode: 'C001', company: 'Alpha Corp', oldName: 'Alpha Trading' },
  { sessionId: 'cust-2', customerCode: 'C002', company: 'Beta Inc', oldName: '' },
  { sessionId: 'cust-3', customerCode: 'C003', company: 'Gamma LLC', oldName: '' },
];

const buildMockLedgerDetailed = () => ({
  customer: { session_id: 'cust-1', company: 'Alpha Corp', customer_code: 'C001' },
  report_type: 'detailed' as const,
  date_type: 'all' as const,
  date_from: null,
  date_to: null,
  metrics: {
    dealership_since: '2018-01-15',
    dealership_sales: 150000,
    dealership_quota: 200000,
    monthly_sales: 25000,
    customer_since: '2018-01-15',
    credit_limit: 50000,
    terms: '30 Days',
    balance: 12500,
    old_name: 'Juan Dela Cruz',
    price_code: 'vip1',
    vip_status: 'silver',
    aging: {
      current: 5000,
      days_31_60: 3000,
      days_61_90: 2000,
      days_91_120: 1500,
      days_121_150: 500,
      over_150: 500,
    },
  },
  rows: [
    {
      id: 1,
      date: '2026-07-15',
      datetime: '2026-07-15T10:30:00',
      reference: 'INV-001',
      ref_no: 'INV-001',
      ref_type: 'Invoice',
      check_no: 'CHK-100',
      check_date: '2026-07-20',
      dcr: 'DCR-01',
      debit: 5000,
      credit: 0,
      pdc: 0,
      balance: 5000,
      remarks: 'Test remark',
      promise_to_pay: '2026-08-01',
    },
    {
      id: 2,
      date: '2026-07-16',
      datetime: '2026-07-16T14:00:00',
      reference: 'OR-002',
      ref_no: 'OR-002',
      ref_type: 'OrderSlip',
      check_no: '',
      check_date: null,
      dcr: 'DCR-02',
      debit: 3000,
      credit: 0,
      pdc: 0,
      balance: 8000,
      remarks: '',
      promise_to_pay: '',
    },
  ],
  summary_rows: [],
  totals: {
    debit: 8000,
    credit: 0,
    pdc: 0,
    balance: 8000,
    row_count: 2,
  },
});

const mockLedgerSummary = {
  ...buildMockLedgerDetailed(),
  report_type: 'summary' as const,
  summary_rows: [
    { year: 2026, month: 7, month_name: 'July', debit: 8000, credit: 0, balance: 8000 },
  ],
  rows: buildMockLedgerDetailed().rows,
};

describe('CustomerLedgerView', () => {
  beforeEach(() => {
    cleanup();
    mockGetCustomers.mockReset();
    mockGetLedger.mockReset();
    mockExportLedgerCsv.mockReset();
    mockGetCustomers.mockResolvedValue([...mockCustomers]);
    mockGetLedger.mockResolvedValue(buildMockLedgerDetailed());
  });

  const selectCustomer = async (name: string) => {
    const user = userEvent.setup();
    render(<CustomerLedgerView />);
    await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
    await user.click(screen.getByText(name));
    return user;
  };

  /* ---------------------------------------------------------------------- */
  /*  Layout                                                                 */
  /* ---------------------------------------------------------------------- */

  it('renders the two-column layout with left search panel and right report area', async () => {
    render(<CustomerLedgerView />);
    expect(screen.getByPlaceholderText('Search customer...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('Select a customer from the left to view their ledger.')).toBeInTheDocument();
  });

  /* ---------------------------------------------------------------------- */
  /*  Customer search                                                        */
  /* ---------------------------------------------------------------------- */

  it('loads and displays customer list in the left panel', async () => {
    render(<CustomerLedgerView />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
      expect(screen.getByText('Gamma LLC')).toBeInTheDocument();
    });
  });

  it('shows customer codes in the left panel', async () => {
    render(<CustomerLedgerView />);
    await waitFor(() => {
      const codes = screen.getAllByText('C001');
      expect(codes.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('C002')).toBeInTheDocument();
    expect(screen.getByText('C003')).toBeInTheDocument();
    expect(screen.getByText('Old Name: Alpha Trading')).toBeInTheDocument();
  });

  it('calls getCustomers with debounced search term', async () => {
    const user = userEvent.setup();
    render(<CustomerLedgerView />);
    await waitFor(() => expect(mockGetCustomers).toHaveBeenCalledWith(''));
    mockGetCustomers.mockClear();
    const input = screen.getByPlaceholderText('Search customer...');
    await user.type(input, 'Alpha');
    await waitFor(
      () => expect(mockGetCustomers).toHaveBeenCalledWith('Alpha'),
      { timeout: 2000 },
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  Preserve selected customer during search                               */
  /* ---------------------------------------------------------------------- */

  it('keeps the selected customer in the list even when search filters them out', async () => {
    const user = userEvent.setup();
    render(<CustomerLedgerView />);

    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Alpha Corp'));

    // Return a filtered list that does NOT include Alpha Corp
    mockGetCustomers.mockResolvedValue([
      { sessionId: 'cust-2', customerCode: 'C002', company: 'Beta Inc', oldName: '' },
    ]);

    const input = screen.getByPlaceholderText('Search customer...');
    await user.type(input, 'Beta');

    await waitFor(
      () => expect(mockGetCustomers).toHaveBeenCalledWith('Beta'),
      { timeout: 2000 },
    );

    // Alpha Corp should still be visible (injected at top)
    await waitFor(() => {
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });
  });

  it('keeps the selected customer and report when a later search request fails', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(screen.getByText('Customer Ledger (Accounting Copy)')).toBeInTheDocument());

    mockGetCustomers.mockRejectedValueOnce(new Error('Search unavailable'));
    await user.type(screen.getByPlaceholderText('Search customer...'), 'Missing');

    await waitFor(
      () => expect(mockGetCustomers).toHaveBeenCalledWith('Missing'),
      { timeout: 2000 },
    );
    expect(screen.getByRole('option', { name: /Alpha Corp/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Customer Ledger (Accounting Copy)')).toBeInTheDocument();
  });

  /* ---------------------------------------------------------------------- */
  /*  Customer selection auto-loads ledger                                   */
  /* ---------------------------------------------------------------------- */

  it('auto-loads ledger when a customer is selected', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(mockGetLedger).toHaveBeenCalledWith('cust-1', expect.objectContaining({ reportType: 'detailed', dateType: 'all' }));
    });
  });

  it('shows the selected customer highlighted in the left panel', async () => {
    const user = userEvent.setup();
    render(<CustomerLedgerView />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Alpha Corp'));
    await waitFor(() => {
      const button = screen.getByRole('option', { name: /Alpha Corp/i });
      expect(button).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('shows placeholder when no customer is selected', async () => {
    render(<CustomerLedgerView />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    expect(screen.getByText('Select a customer from the left to view their ledger.')).toBeInTheDocument();
    expect(mockGetLedger).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------------- */
  /*  Report header — new fields                                             */
  /* ---------------------------------------------------------------------- */

  it('shows report header with company name after selection', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      const headers = screen.getAllByText('Customer Ledger: Alpha Corp');
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays old name (customer name) in the info strip', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      const matches = screen.getAllByText('Juan Dela Cruz');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays VIP status', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Silver')).toBeInTheDocument();
    });
  });

  it('displays Price Code', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('vip1')).toBeInTheDocument();
    });
  });

  it('displays Customer Since', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Customer Since:')).toBeInTheDocument();
    });
  });

  it('displays Total Sales (This Month)', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Total Sales (This Month):')).toBeInTheDocument();
    });
  });

  it('displays Outstanding Balance', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Outstanding Balance:')).toBeInTheDocument();
    });
  });

  it('displays Terms', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('30 Days')).toBeInTheDocument();
    });
  });

  it('displays Credit Limit', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Credit Limit:')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Aging buckets                                                          */
  /* ---------------------------------------------------------------------- */

  it('renders aging buckets table with all 6 columns and total', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Aging Balances')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('31–60 Days')).toBeInTheDocument();
      expect(screen.getByText('61–90 Days')).toBeInTheDocument();
      expect(screen.getByText('91–120 Days')).toBeInTheDocument();
      expect(screen.getByText('121–150 Days')).toBeInTheDocument();
      expect(screen.getByText('Over 150 Days')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Detailed table (old-system format)                                     */
  /* ---------------------------------------------------------------------- */

  it('renders detailed table with all required columns', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      const cols = ['Date', 'Ref', 'Chk No.', 'Chk Date', 'DCR', 'Debit', 'Credit', 'PDC', 'Balance', 'Remarks', 'Promise to Pay'];
      cols.forEach((col) => {
        expect(screen.getByText(col)).toBeInTheDocument();
      });
    });
  });

  it('shows ledger row data correctly', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('CHK-100')).toBeInTheDocument();
      expect(screen.getByText('DCR-01')).toBeInTheDocument();
      expect(screen.getByText('Test remark')).toBeInTheDocument();
    });
  });

  it('shows totals row with TOTAL label', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('TOTAL')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Summary report                                                         */
  /* ---------------------------------------------------------------------- */

  it('switches to summary view when summary radio is selected', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(screen.getByText('Customer Ledger: Alpha Corp')).toBeInTheDocument());

    mockGetLedger.mockResolvedValue({ ...mockLedgerSummary });

    const summaryRadio = screen.getByLabelText('Summary') as HTMLInputElement;
    await user.click(summaryRadio);

    await waitFor(() => {
      expect(mockGetLedger).toHaveBeenCalledWith('cust-1', expect.objectContaining({ reportType: 'summary' }));
      expect(screen.getByText('July')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Date filter                                                            */
  /* ---------------------------------------------------------------------- */

  it('reloads ledger when date type changes', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(mockGetLedger).toHaveBeenCalledWith('cust-1', expect.objectContaining({ dateType: 'all' })));
    mockGetLedger.mockClear();
    const dateSelect = screen.getByRole('combobox');
    await user.selectOptions(dateSelect, 'week');
    await waitFor(() => {
      expect(mockGetLedger).toHaveBeenCalledWith('cust-1', expect.objectContaining({ dateType: 'week' }));
    });
  });

  it('shows custom date inputs when custom date is selected', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(screen.getByText('Customer Ledger: Alpha Corp')).toBeInTheDocument());
    const dateSelect = screen.getByRole('combobox');
    await user.selectOptions(dateSelect, 'custom');
    await waitFor(() => {
      expect(screen.getByLabelText('Date from')).toBeInTheDocument();
      expect(screen.getByLabelText('Date to')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Error states                                                           */
  /* ---------------------------------------------------------------------- */

  it('displays an error banner when ledger load fails', async () => {
    mockGetLedger.mockRejectedValue(new Error('Network failure'));
    const user = userEvent.setup();
    render(<CustomerLedgerView />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Alpha Corp'));
    await waitFor(() => {
      expect(screen.getByText(/Oops!/)).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Loading                                                                */
  /* ---------------------------------------------------------------------- */

  it('shows loading state while ledger is being fetched', async () => {
    mockGetLedger.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<CustomerLedgerView />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Alpha Corp'));
    await waitFor(() => {
      expect(screen.getByText('Loading ledger...')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Export Excel                                                           */
  /* ---------------------------------------------------------------------- */

  it('renders Export Excel button when report is shown', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Export Excel')).toBeInTheDocument();
    });
  });

  it('calls exportLedgerCsv when Export Excel is clicked', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(screen.getByText('Export Excel')).toBeInTheDocument());
    const btn = screen.getByText('Export Excel');
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(mockExportLedgerCsv).toHaveBeenCalledTimes(1);
  });

  /* ---------------------------------------------------------------------- */
  /*  Back button                                                            */
  /* ---------------------------------------------------------------------- */

  it('renders Back button when report is shown', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('← Back')).toBeInTheDocument();
    });
  });

  it('clears the report when Back is clicked', async () => {
    const user = await selectCustomer('Alpha Corp');
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument());
    await user.click(screen.getByText('← Back'));
    await waitFor(() => {
      expect(screen.getByText('Select a customer from the left to view their ledger.')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Print button                                                           */
  /* ---------------------------------------------------------------------- */

  it('renders Print button when report is shown', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      expect(screen.getByText('Print')).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Scrolling containers                                                   */
  /* ---------------------------------------------------------------------- */

  it('renders independent scroll areas for customer list and report', async () => {
    // Add many customers to force scroll
    const manyCustomers = Array.from({ length: 50 }, (_, i) => ({
      sessionId: `cust-${i}`,
      customerCode: `C${String(i).padStart(3, '0')}`,
      company: `Customer ${i}`,
    }));
    mockGetCustomers.mockResolvedValue(manyCustomers);
    render(<CustomerLedgerView />);

    await waitFor(() => {
      const listScroll = screen.getByTestId('customer-list-scroll');
      expect(listScroll).toBeInTheDocument();
    });
  });

  it('renders report scroll area when a customer is selected', async () => {
    await selectCustomer('Alpha Corp');
    await waitFor(() => {
      const reportScroll = screen.getByTestId('ledger-report-scroll');
      expect(reportScroll).toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Empty state                                                            */
  /* ---------------------------------------------------------------------- */

  it('shows "No customers available" when customer list is empty', async () => {
    mockGetCustomers.mockResolvedValue([]);
    render(<CustomerLedgerView />);
    await waitFor(() => {
      expect(screen.getByText('No customers available')).toBeInTheDocument();
    });
  });
});
