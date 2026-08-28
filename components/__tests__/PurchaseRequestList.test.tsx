import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PurchaseRequestList from '../PurchaseRequest/PurchaseRequestList';

vi.mock('../ModuleRecordLink', () => ({
  default: ({ children, onOpen, ...props }: { children: React.ReactNode; onOpen?: () => void }) => <a {...props} href="#" onClick={event => { event.preventDefault(); onOpen?.(); }}>{children}</a>,
}));

afterEach(() => cleanup());

describe('PurchaseRequestList', () => {
  it('renders the reference sidebar and applies filter controls', () => {
    const onSelect = vi.fn();
    const setFilterMonth = vi.fn();
    const setFilterYear = vi.fn();
    const setFilterStatus = vi.fn();
    const setSearch = vi.fn();
    render(<PurchaseRequestList requests={[{ id: 'ref-1', pr_number: 'PR-26126', request_date: '2026-03-25', status: 'Pending', items: [{}, {}], item_count: 2 } as any]} loading={false} onSelect={onSelect} onCreate={vi.fn()} filterMonth="03" setFilterMonth={setFilterMonth} filterYear="2026" setFilterYear={setFilterYear} filterStatus="All Statuses" setFilterStatus={setFilterStatus} search="" setSearch={setSearch} />);

    expect(screen.getByRole('button', { name: /new request/i })).toBeInTheDocument();
    expect(screen.getByText('PR-26126')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search PR #...'), { target: { value: 'PR-26' } });
    fireEvent.change(screen.getByLabelText('Filter by month'), { target: { value: '04' } });
    fireEvent.change(screen.getByLabelText('Filter by year'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'Approved' } });
    expect(setSearch).toHaveBeenCalledWith('PR-26');
    expect(setFilterMonth).toHaveBeenCalledWith('04');
    expect(setFilterYear).toHaveBeenCalledWith('2025');
    expect(setFilterStatus).toHaveBeenCalledWith('Approved');

    fireEvent.click(screen.getByText('PR-26126'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ref-1' }));
  });

  it('supports an all-date history view and distinguishes load errors from no records', () => {
    const onRetry = vi.fn();
    const setFilterMonth = vi.fn();
    const setFilterYear = vi.fn();
    const { rerender } = render(<PurchaseRequestList requests={[]} loading={false} error="History service unavailable" onRetry={onRetry} onSelect={vi.fn()} onCreate={vi.fn()} filterMonth="" setFilterMonth={setFilterMonth} filterYear="" setFilterYear={setFilterYear} filterStatus="All Statuses" setFilterStatus={vi.fn()} search="" setSearch={vi.fn()} />);

    expect(screen.getByRole('complementary', { name: /purchase request history/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load PR history');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<PurchaseRequestList requests={[]} loading={false} onSelect={vi.fn()} onCreate={vi.fn()} filterMonth="" setFilterMonth={setFilterMonth} filterYear="" setFilterYear={setFilterYear} filterStatus="All Statuses" setFilterStatus={vi.fn()} search="" setSearch={vi.fn()} />);
    expect(screen.getByLabelText('Filter by month')).toHaveValue('');
    expect(screen.getByLabelText('Filter by year')).toHaveValue(null);
    expect(screen.getByText('All years')).toBeInTheDocument();
    expect(screen.getByText('No purchase requests found for this filter.')).toBeInTheDocument();
  });
});
