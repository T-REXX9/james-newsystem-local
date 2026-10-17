import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('opens the full image after a downward pull from the top of the profile', () => {
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
    const headerImage = screen.getByAltText('Example Customer cover photo');
    expect(headerImage).toHaveClass('object-contain', 'object-center');
    expect(headerImage).not.toHaveStyle({ objectPosition: '20% 80%' });
    const profileScroller = imageButton.closest('.overflow-y-auto');
    expect(profileScroller).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument();

    fireEvent.touchStart(profileScroller!, { touches: [{ identifier: 1, clientY: 100 }] });
    fireEvent.touchEnd(profileScroller!, { changedTouches: [{ identifier: 1, clientY: 210 }] });

    expect(screen.getByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
  });
});
