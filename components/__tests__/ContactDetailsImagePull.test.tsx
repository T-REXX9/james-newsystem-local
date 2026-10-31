import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactDetails from '../ContactDetails';
import { customerLedgerService } from '../../services/customerLedgerService';
import { CustomerStatus } from '../../types';

vi.mock('../CustomerMetricsView', () => ({ default: () => null }));
vi.mock('../SalesReportTab', () => ({ default: () => null }));
vi.mock('../CustomerSalesReportChat', () => ({ default: () => null }));
vi.mock('../IncidentReportTab', () => ({ default: () => null }));
vi.mock('../SalesReturnTab', () => ({ default: () => null }));
vi.mock('../PurchaseHistoryTab', () => ({ default: () => null }));
vi.mock('../InquiryHistoryTab', () => ({ default: () => null }));
vi.mock('../DiscountRequestModal', () => ({ default: () => null }));
vi.mock('../AddContactModal', () => ({ default: () => null }));
vi.mock('../CustomerRequestsTab', () => ({ default: () => null }));
vi.mock('recharts', () => ({
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: () => null,
}));

describe('ContactDetails image expansion', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => cleanup());

  const renderProfile = () => {
    render(
      <ContactDetails
        contact={{
          id: 'customer-1',
          company: 'Example Customer',
          status: CustomerStatus.ACTIVE,
          recordImage: 'data:image/png;base64,abc',
          recordImagePosition: '20,80',
        } as any}
        currentUser={{ id: 'master-1', role: 'Master User' } as any}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );
    const imageButton = screen.getByRole('button', { name: 'View full customer image' });
    return imageButton.closest('.overflow-y-auto')!;
  };

  it('opens the full image after a downward pull from the top of the profile', () => {
    const profileScroller = renderProfile();

    const headerImage = screen.getByAltText('Example Customer cover photo');
    expect(headerImage).toHaveClass('object-cover', 'object-center');
    expect(headerImage).not.toHaveStyle({ objectPosition: '20% 80%' });
    expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument();

    fireEvent.touchStart(profileScroller!, { touches: [{ identifier: 1, clientY: 100 }] });
    fireEvent.touchEnd(profileScroller!, { changedTouches: [{ identifier: 1, clientY: 210 }] });

    expect(screen.getByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
  });

  it('shows an immediate, animated hover preview and fades it closed on pointer exit', async () => {
    renderProfile();

    const imageButton = screen.getByRole('button', { name: 'View full customer image' });
    const image = screen.getByAltText('Example Customer cover photo');
    fireEvent.mouseEnter(imageButton);

    expect(image).toHaveClass('object-contain');
    expect(imageButton).toHaveClass('fixed', 'z-[2000]');
    expect(imageButton.className).toContain('james-modal-in');
    expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument();

    fireEvent.mouseLeave(image);
    expect(imageButton).toHaveClass('opacity-0', 'transition-opacity');
    await waitFor(() => expect(imageButton).not.toHaveClass('fixed'));
    expect(image).toHaveClass('object-cover');
  });

  it('cancels the close fade when the pointer re-enters the preview', async () => {
    renderProfile();
    const imageButton = screen.getByRole('button', { name: 'View full customer image' });
    const image = screen.getByAltText('Example Customer cover photo');

    fireEvent.mouseEnter(imageButton);
    fireEvent.mouseLeave(image);
    expect(imageButton).toHaveClass('opacity-0');

    fireEvent.mouseEnter(image);
    expect(imageButton).not.toHaveClass('opacity-0');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(imageButton).toHaveClass('fixed');
  });

  it('keeps click-to-open and does not reopen the hover preview after close until pointer leaves', async () => {
    renderProfile();
    const imageButton = screen.getByRole('button', { name: 'View full customer image' });

    fireEvent.mouseEnter(imageButton);
    fireEvent.click(imageButton);
    expect(screen.getByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close full image' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument());

    fireEvent.mouseEnter(imageButton);
    expect(imageButton).not.toHaveClass('fixed');

    fireEvent.mouseLeave(imageButton);
    fireEvent.mouseEnter(imageButton);
    expect(imageButton).toHaveClass('fixed');
  });

  it('opens when a downward pull starts below the top and reaches the top', () => {
    const profileScroller = renderProfile();
    profileScroller.scrollTop = 200;

    fireEvent.touchStart(profileScroller, { touches: [{ identifier: 1, clientY: 100 }] });
    profileScroller.scrollTop = 0;
    fireEvent.touchEnd(profileScroller, { changedTouches: [{ identifier: 1, clientY: 210 }] });

    expect(screen.getByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
  });

  it('does not open when a downward pull ends while still below the top', () => {
    const profileScroller = renderProfile();
    profileScroller.scrollTop = 200;

    fireEvent.touchStart(profileScroller, { touches: [{ identifier: 1, clientY: 100 }] });
    fireEvent.touchEnd(profileScroller, { changedTouches: [{ identifier: 1, clientY: 210 }] });

    expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument();
  });

  it('does not open after a short downward pull at the top', () => {
    const profileScroller = renderProfile();

    fireEvent.touchStart(profileScroller, { touches: [{ identifier: 1, clientY: 100 }] });
    fireEvent.touchEnd(profileScroller, { changedTouches: [{ identifier: 1, clientY: 180 }] });

    expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument();
  });

  it('shows a contact number only once when duplicate fields use different formatting', () => {
    render(
      <ContactDetails
        contact={{
          id: 'customer-1',
          company: 'Example Customer',
          status: CustomerStatus.ACTIVE,
          phone: '09171234567',
          mobile: '0917-123-4567',
          contactPersons: [{
            id: 'person-1',
            enabled: true,
            name: 'Alex Customer',
            position: '',
            birthday: '',
            telephone: '0917 123 4567',
            mobile: '0917-123-4567',
            email: '',
          }],
        } as any}
        currentUser={{ id: 'master-1', role: 'Master User' } as any}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    const numbersList = screen.getByRole('list', { name: 'Contact numbers' });
    expect(within(numbersList).getAllByText('0917-123-4567')).toHaveLength(1);
    expect(screen.queryByText('T1:')).not.toBeInTheDocument();
  });

  it('does not show the previous customer ledger summary while a new customer loads', async () => {
    let resolveSecondLedger!: (value: unknown) => void;
    const secondLedger = new Promise((resolve) => {
      resolveSecondLedger = resolve;
    });
    const ledgerSpy = vi.spyOn(customerLedgerService, 'getLedger')
      .mockResolvedValueOnce({
        metrics: {
          last_month_sales: 12000,
          monthly_sales: 6000,
          ledger_monthly_sales: 6000,
          vip_status: 'silver',
          vip_one_time_discount_threshold: 10000,
          vip_unlimited_discount_threshold: 30000,
        },
      } as any)
      .mockReturnValueOnce(secondLedger as ReturnType<typeof customerLedgerService.getLedger>);

    const initialProps = {
      contact: { id: 'customer-1', company: 'First Customer', status: CustomerStatus.ACTIVE } as any,
      currentUser: { id: 'agent-1', role: 'Sales Agent' } as any,
      showAgentSalesReportInOverview: true,
      onClose: vi.fn(),
      onUpdate: vi.fn(),
    };
    const { rerender } = render(<ContactDetails {...initialProps} />);
    await waitFor(() => expect(screen.getByText('₱12,000')).toBeInTheDocument());

    rerender(<ContactDetails {...initialProps} contact={{ ...initialProps.contact, id: 'customer-2', company: 'Second Customer' }} />);
    expect(screen.getAllByText('Loading…')).toHaveLength(3);
    expect(screen.queryByText('₱12,000')).not.toBeInTheDocument();

    resolveSecondLedger({
      metrics: {
        last_month_sales: 35000,
        monthly_sales: 20000,
        ledger_monthly_sales: 20000,
        vip_status: 'gold',
        vip_one_time_discount_threshold: 10000,
        vip_unlimited_discount_threshold: 30000,
      },
    });
    await waitFor(() => expect(screen.getByText('₱35,000')).toBeInTheDocument());
    expect(screen.getByText('₱20,000')).toBeInTheDocument();
    ledgerSpy.mockRestore();
  });
});
