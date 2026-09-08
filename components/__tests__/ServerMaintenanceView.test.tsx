import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerMaintenanceView from '../ServerMaintenanceView';

const fetchStatus = vi.fn();
const downloadBackup = vi.fn();
const addToast = vi.fn();

vi.mock('../../services/serverMaintenanceService', () => ({
  fetchServerMaintenanceStatus: (...args: unknown[]) => fetchStatus(...args),
  downloadFullDatabaseBackup: (...args: unknown[]) => downloadBackup(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast }),
}));

describe('ServerMaintenanceView', () => {
  beforeEach(() => {
    fetchStatus.mockReset();
    downloadBackup.mockReset();
    addToast.mockReset();
    fetchStatus.mockResolvedValue({
      database_name: 'topnotch_migrate',
      backup_available: true,
      format: 'sql.gz',
      description: 'Full logical dump of the application database.',
    });
  });

  afterEach(cleanup);

  it('blocks non-master users', () => {
    render(<ServerMaintenanceView currentUser={{ id: '2', email: 'a@b.c', role: 'Company Owner', user_type: '2' } as any} />);
    expect(screen.getByRole('heading', { name: 'Master User access required' })).toBeInTheDocument();
  });

  it('lets the Master User download a full dump', async () => {
    const user = userEvent.setup();
    downloadBackup.mockResolvedValue({ filename: 'topnotch_migrate_full_20260101_120000.sql.gz', bytes: 2048 });

    render(
      <ServerMaintenanceView
        currentUser={{ id: '1', email: 'owner@example.com', role: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByText('topnotch_migrate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download full dump' }));

    await waitFor(() => {
      expect(downloadBackup).toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });
});
