import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactDetails from '../ContactDetails';
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

  it('opens the full image when hovering over the header photo and allows it to close', async () => {
    renderProfile();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'View full customer image' }));

    const lightbox = screen.getByRole('dialog', { name: 'Full customer image' });
    expect(lightbox).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'View full customer image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close full image' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument());
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
});
