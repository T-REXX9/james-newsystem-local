import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerMaintenanceView from '../ServerMaintenanceView';

const fetchStatus = vi.fn();
const downloadBackup = vi.fn();
const fetchDestinations = vi.fn();
const saveAutomaticBackup = vi.fn();
const importCorporateDump = vi.fn();
const addToast = vi.fn();

vi.mock('../../services/serverMaintenanceService', () => ({
  fetchServerMaintenanceStatus: (...args: unknown[]) => fetchStatus(...args),
  downloadFullDatabaseBackup: (...args: unknown[]) => downloadBackup(...args),
  fetchBackupDestinations: (...args: unknown[]) => fetchDestinations(...args),
  saveAutomaticBackupSettings: (...args: unknown[]) => saveAutomaticBackup(...args),
  importCorporateDumpFile: (...args: unknown[]) => importCorporateDump(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast }),
}));

describe('ServerMaintenanceView', () => {
  beforeEach(() => {
    fetchStatus.mockReset();
    downloadBackup.mockReset();
    fetchDestinations.mockReset();
    saveAutomaticBackup.mockReset();
    importCorporateDump.mockReset();
    addToast.mockReset();
    fetchStatus.mockResolvedValue({
      database_name: 'topnotch_migrate',
      backup_available: true,
      format: 'sql.gz',
      description: 'Full logical dump of the application database.',
      corporate_dump_import: {
        supported_extensions: ['.sql', '.sql.gz'],
        max_bytes: 2147483648,
        chunk_max_bytes: 2097152,
        safety: 'Never drops or truncates live tables.',
      },
      automatic_backup: {
        enabled: false,
        frequency: 'daily',
        weekly_days: [],
        time: '02:00',
        timezone: 'Asia/Manila',
        destination_path: '',
        retention_count: 14,
        last_success_at: null,
        last_failure_at: null,
        last_failure_message: null,
        last_run_key: null,
      },
    });
    fetchDestinations.mockResolvedValue([
      { id: '/Volumes/USB', label: 'USB', path: '/Volumes/USB' },
    ]);
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

  it('blocks enabling Automatic Backup without a Backup Destination', async () => {
    const user = userEvent.setup();

    render(
      <ServerMaintenanceView
        currentUser={{ id: '1', email: 'owner@example.com', role: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByText('Automatic Backup')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Enable Automatic Backup/i }));

    const saveButton = screen.getByRole('button', { name: 'Save Automatic Backup' });
    expect(saveButton).toBeDisabled();
    expect(saveAutomaticBackup).not.toHaveBeenCalled();
  });

  it('shows Automatic Backup failure banner', async () => {
    fetchStatus.mockResolvedValue({
      database_name: 'topnotch_migrate',
      backup_available: true,
      format: 'sql.gz',
      description: 'Full logical dump of the application database.',
      automatic_backup: {
        enabled: true,
        frequency: 'daily',
        weekly_days: [],
        time: '02:00',
        timezone: 'Asia/Manila',
        destination_path: '/Volumes/USB',
        retention_count: 14,
        last_success_at: null,
        last_failure_at: '2026-09-09T02:00:00+08:00',
        last_failure_message: 'Backup Destination is missing, unmounted, or not writable.',
        last_run_key: '2026-09-09T02:00',
      },
    });

    render(
      <ServerMaintenanceView
        currentUser={{ id: '1', email: 'owner@example.com', role: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Backup Destination is missing, unmounted, or not writable.'
    );
  });

  it('shows corporate dump import and runs it for Master User', async () => {
    const user = userEvent.setup();
    importCorporateDump.mockResolvedValue({
      filename: 'corp.sql.gz',
      bytes: 1024,
      import: {
        tables_merged: 10,
        tables_skipped_missing: [],
        tables_skipped_keyless: [],
        tables_skipped_no_shared_columns: [],
        affected_rows: 42,
        details: [],
      },
    });

    render(
      <ServerMaintenanceView
        currentUser={{ id: '1', email: 'owner@example.com', role: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Import corporate dump' })).toBeInTheDocument();
    expect(screen.getByText(/Never drops or truncates live tables/i)).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(['dump'], 'corp.sql.gz', { type: 'application/gzip' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(importCorporateDump).toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
    expect(await screen.findByText(/Merged 10 tables/i)).toBeInTheDocument();
  });
});
