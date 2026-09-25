import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerAutocomplete from '../CustomerAutocomplete';

describe('CustomerAutocomplete', () => {
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    cleanup();
    rectSpy.mockReset();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });

  it('opens above the input when the lower viewport does not have enough room', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    rectSpy.mockReturnValue({
      x: 24,
      y: 500,
      top: 500,
      bottom: 538,
      left: 24,
      right: 244,
      width: 220,
      height: 38,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <CustomerAutocomplete
        contacts={[{ id: 'customer-1', company: 'Customer One' }]}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Search customer...'));

    await waitFor(() => {
      expect(document.getElementById('customer-autocomplete-dropdown')).toHaveStyle({
        top: '176px',
        maxHeight: '320px',
      });
    });
  });

  it('shows every supplied customer when the search is blank', () => {
    const contacts = Array.from({ length: 51 }, (_, index) => ({
      id: `customer-${index + 1}`,
      company: `Customer ${String(index + 1).padStart(2, '0')}`,
    }));

    render(<CustomerAutocomplete contacts={contacts} onSelect={vi.fn()} />);

    fireEvent.focus(screen.getByPlaceholderText('Search customer...'));

    expect(screen.getByText('Customer 51')).toBeInTheDocument();
  });
});
