import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatementOfAccountView from '../StatementOfAccountView';

const getCustomersMock = vi.fn();

vi.mock('../../services/statementOfAccountService', () => ({
  statementOfAccountService: {
    getCustomers: (...args: unknown[]) => getCustomersMock(...args),
    getStatement: vi.fn(),
  },
}));

describe('StatementOfAccountView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomersMock.mockResolvedValue([
      { sessionId: 'customer-1', customerCode: 'C-001', company: 'Alpha Motors' },
    ]);
  });

  it('does not tell users that a blank customer selection will show all customers', () => {
    render(<StatementOfAccountView />);

    expect(screen.queryByPlaceholderText(/leave it blank to show all customers/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search customer/i)).toBeInTheDocument();
  });
});
