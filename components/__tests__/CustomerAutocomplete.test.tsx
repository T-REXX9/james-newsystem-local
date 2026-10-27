import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerAutocomplete from '../CustomerAutocomplete';

describe('CustomerAutocomplete', () => {
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  const originalInnerHeight = window.innerHeight;
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

  afterEach(() => {
    cleanup();
    rectSpy.mockReset();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    }
  });

  it('opens above the input when the lower viewport does not have enough room', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return this.getAttribute('role') === 'listbox' ? 160 : 0; },
    });
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
      expect(screen.getByRole('listbox')).toHaveStyle({
        top: '336px',
        maxHeight: '160px',
      });
    });
  });

  it('opens below a table field when the results fit in the remaining space', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return this.getAttribute('role') === 'listbox' ? 160 : 0; },
    });
    rectSpy.mockReturnValue({
      x: 24,
      y: 350,
      top: 350,
      bottom: 388,
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
      expect(screen.getByRole('listbox')).toHaveStyle({
        top: '392px',
        maxHeight: '160px',
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

  it('keeps typed text when the selected customer is refreshed with the same identity and display name', () => {
    const { rerender } = render(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-1', company: 'Customer One' }}
      />,
    );
    const input = screen.getByPlaceholderText('Search customer...');

    fireEvent.change(input, { target: { value: 'Another customer' } });
    rerender(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-1', company: 'Customer One' }}
      />,
    );

    expect(input).toHaveValue('Another customer');
  });

  it('updates the query when the selected customer identity or display name changes', () => {
    const { rerender } = render(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-1', company: 'Customer One' }}
      />,
    );
    const input = screen.getByPlaceholderText('Search customer...');

    fireEvent.change(input, { target: { value: 'Another customer' } });
    rerender(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-2', company: 'Customer Two' }}
      />,
    );

    expect(input).toHaveValue('Customer Two');

    fireEvent.change(input, { target: { value: 'Edited query' } });
    rerender(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-2', company: 'Updated Customer Two' }}
      />,
    );

    expect(input).toHaveValue('Updated Customer Two');
  });

  it('clears the query when the selected customer is cleared', () => {
    const { rerender } = render(
      <CustomerAutocomplete
        contacts={[]}
        onSelect={vi.fn()}
        selectedCustomer={{ id: 'customer-1', company: 'Customer One' }}
      />,
    );
    const input = screen.getByPlaceholderText('Search customer...');

    fireEvent.change(input, { target: { value: 'Another customer' } });
    rerender(<CustomerAutocomplete contacts={[]} onSelect={vi.fn()} selectedCustomer={null} />);

    expect(input).toHaveValue('');
  });
});
