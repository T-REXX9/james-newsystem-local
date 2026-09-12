import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, DatabaseBackup, Download, FileUp, HardDrive, RefreshCw, Save } from 'lucide-react';
import { UserProfile } from '../types';
import { isMasterUserType } from '../constants';
import {
  AutomaticBackupFrequency,
  AutomaticBackupSettings,
  BackupDestination,
  CorporateDumpImportReport,
  downloadFullDatabaseBackup,
  fetchBackupDestinations,
  fetchServerMaintenanceStatus,
  importCorporateDumpFile,
  saveAutomaticBackupSettings,
  ServerMaintenanceStatus,
} from '../services/serverMaintenanceService';
import { useToast } from './ToastProvider';

interface ServerMaintenanceViewProps {
  currentUser: UserProfile | null;
}

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const defaultDraft = (): AutomaticBackupSettings => ({
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
});

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const ServerMaintenanceView: React.FC<ServerMaintenanceViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [status, setStatus] = useState<ServerMaintenanceStatus | null>(null);
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [draft, setDraft] = useState<AutomaticBackupSettings>(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importReport, setImportReport] = useState<CorporateDumpImportReport | null>(null);
  const [selectedDumpName, setSelectedDumpName] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadAll = useCallback(async () => {
    if (!isMasterUserType(currentUser)) return;
    setLoading(true);
    setLoadError('');
    try {
      const [nextStatus, nextDestinations] = await Promise.all([
        fetchServerMaintenanceStatus(),
        fetchBackupDestinations(),
      ]);
      setStatus(nextStatus);
      setDestinations(nextDestinations);
      setDraft({ ...defaultDraft(), ...(nextStatus.automatic_backup || {}) });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load server maintenance status.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const canEnable = useMemo(() => draft.destination_path.trim() !== '', [draft.destination_path]);

  if (!isMasterUserType(currentUser)) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Master User access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Only the Master User can create and download a full database backup.
          </p>
        </div>
      </div>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await downloadFullDatabaseBackup();
      addToast({
        type: 'success',
        message: `Downloaded ${result.filename} (${formatBytes(result.bytes)}).`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to download database backup.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const toggleWeekday = (day: number) => {
    setDraft((prev) => {
      const exists = prev.weekly_days.includes(day);
      const weekly_days = exists
        ? prev.weekly_days.filter((value) => value !== day)
        : [...prev.weekly_days, day].sort((a, b) => a - b);
      return { ...prev, weekly_days };
    });
  };

  const handleSaveAutomaticBackup = async () => {
    if (draft.enabled && !canEnable) {
      addToast({
        type: 'error',
        message: 'Choose a Backup Destination before enabling Automatic Backup.',
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAutomaticBackupSettings({
        enabled: draft.enabled,
        frequency: draft.frequency,
        weekly_days: draft.frequency === 'weekly' ? draft.weekly_days : [],
        time: draft.time,
        destination_path: draft.destination_path,
        retention_count: draft.retention_count,
      });
      setDraft({ ...defaultDraft(), ...saved });
      addToast({ type: 'success', message: 'Automatic Backup settings saved.' });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save Automatic Backup settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Maintenance / Profile</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              <HardDrive className="h-7 w-7 text-blue-700" /> Server Maintenance
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Create a complete logical dump of the live database, import a corporate SQL dump safely, and configure Automatic Backup to a connected drive.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading || downloading || saving || importing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </button>
        </header>

        {draft.last_failure_message ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            <p className="font-bold">Automatic Backup failure</p>
            <p className="mt-1">{draft.last_failure_message}</p>
            {draft.last_failure_at ? (
              <p className="mt-2 text-xs text-rose-700">Last failure: {draft.last_failure_at}</p>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <DatabaseBackup className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-bold">Full database backup</h2>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {status?.description ||
                  'Exports schema, data, routines, triggers, and events as a compressed SQL dump (.sql.gz).'}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-500">Database</dt>
                  <dd className="mt-1 font-bold text-slate-900 dark:text-white">
                    {loading && !status ? 'Loading…' : status?.database_name || 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Download format</dt>
                  <dd className="mt-1 font-bold text-slate-900 dark:text-white">
                    {status?.format || 'sql.gz'}
                  </dd>
                </div>
              </dl>
              {loadError ? (
                <p className="mt-4 text-sm font-medium text-rose-600" role="alert">
                  {loadError}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || loading || !status?.backup_available}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className={downloading ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
              {downloading ? 'Preparing backup…' : 'Download full dump'}
            </button>
          </div>
          {downloading ? (
            <p className="mt-4 text-sm text-slate-500">
              Building the dump can take a while on large databases. Keep this tab open until the download starts.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <FileUp className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold">Import corporate dump</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {status?.corporate_dump_import?.safety ||
              'Loads a corporate .sql / .sql.gz dump into a temporary staging database, then inserts or updates only shared columns on existing tables. Never drops tables, never truncates, and never deletes rows. Local-only tables and columns stay untouched.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <input
                type="file"
                accept=".sql,.gz,application/sql,application/gzip"
                className="sr-only"
                disabled={importing || loading}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedDumpName(file?.name || '');
                  setImportReport(null);
                  if (!file) return;
                  void (async () => {
                    setImporting(true);
                    setImportProgress('Preparing upload…');
                    try {
                      const report = await importCorporateDumpFile(file, {
                        onProgress: ({ uploadedBytes, totalBytes, phase }) => {
                          if (phase === 'upload') {
                            const pct = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
                            setImportProgress(`Uploading dump… ${pct}%`);
                            return;
                          }
                          setImportProgress('Merging into live database (no drops)…');
                        },
                      });
                      setImportReport(report);
                      addToast({
                        type: 'success',
                        message: `Imported ${report.filename}: ${report.import.tables_merged} tables merged, ${report.import.affected_rows} rows affected.`,
                      });
                    } catch (error) {
                      addToast({
                        type: 'error',
                        message: error instanceof Error ? error.message : 'Unable to import corporate dump.',
                      });
                    } finally {
                      setImporting(false);
                      setImportProgress('');
                      event.target.value = '';
                    }
                  })();
                }}
              />
              Choose .sql / .sql.gz…
            </label>
            {selectedDumpName ? (
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedDumpName}</p>
            ) : (
              <p className="text-sm text-slate-500">No dump selected yet.</p>
            )}
          </div>

          {importing ? (
            <p className="mt-4 text-sm text-slate-500" role="status">
              {importProgress || 'Import in progress… Keep this tab open.'}
            </p>
          ) : null}

          {importReport ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold">
                Last import: {importReport.filename} ({formatBytes(importReport.bytes)})
              </p>
              <p className="mt-1">
                Merged {importReport.import.tables_merged} tables · affected rows {importReport.import.affected_rows}
              </p>
              {importReport.import.tables_skipped_missing.length > 0 ? (
                <p className="mt-2 text-xs">
                  Skipped missing tables: {importReport.import.tables_skipped_missing.join(', ')}
                </p>
              ) : null}
              {importReport.import.tables_skipped_keyless.length > 0 ? (
                <p className="mt-1 text-xs">
                  Skipped keyless tables: {importReport.import.tables_skipped_keyless.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarClock className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold">Automatic Backup</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            One recurring Full Database Dump schedule. Times use Philippine Standard Time (Asia/Manila). Files are stored as{' '}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
              backups/YYYY/MM/{'{dbname}'}_full_YYYYMMDD_HHMM.sql.gz
            </code>{' '}
            on the chosen Backup Destination.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              Enable Automatic Backup
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-500">Frequency</span>
              <select
                value={draft.frequency}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    frequency: event.target.value as AutomaticBackupFrequency,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-500">Time (PST)</span>
              <input
                type="time"
                value={draft.time}
                onChange={(event) => setDraft((prev) => ({ ...prev, time: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-500">Keep last N backups</span>
              <input
                type="number"
                min={1}
                max={365}
                value={draft.retention_count}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    retention_count: Number(event.target.value) || 1,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold text-slate-500">Backup Destination</span>
              <select
                value={draft.destination_path}
                onChange={(event) => setDraft((prev) => ({ ...prev, destination_path: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Select a connected hard drive or USB…</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.path}>
                    {destination.label} ({destination.path})
                  </option>
                ))}
                {draft.destination_path &&
                !destinations.some((destination) => destination.path === draft.destination_path) ? (
                  <option value={draft.destination_path}>{draft.destination_path} (saved)</option>
                ) : null}
              </select>
              {destinations.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No writable mounted volumes were found under /Volumes, /media, or /mnt. Connect a drive or set
                  BACKUP_DESTINATION_ROOTS on the API host.
                </p>
              ) : null}
            </label>
          </div>

          {draft.frequency === 'weekly' ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-500">Weekdays</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = draft.weekly_days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {draft.last_success_at ? `Last success: ${draft.last_success_at}` : 'No successful Automatic Backup yet.'}
            </p>
            <button
              type="button"
              onClick={() => void handleSaveAutomaticBackup()}
              disabled={saving || loading || (draft.enabled && !canEnable)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Automatic Backup'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ServerMaintenanceView;
