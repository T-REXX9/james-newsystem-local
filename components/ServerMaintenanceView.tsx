import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DatabaseBackup, Download, HardDrive, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { isMasterUserType } from '../constants';
import {
  downloadFullDatabaseBackup,
  fetchServerMaintenanceStatus,
  ServerMaintenanceStatus,
} from '../services/serverMaintenanceService';
import { useToast } from './ToastProvider';

interface ServerMaintenanceViewProps {
  currentUser: UserProfile | null;
}

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
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadStatus = useCallback(async () => {
    if (!isMasterUserType(currentUser)) return;
    setLoading(true);
    setLoadError('');
    try {
      const next = await fetchServerMaintenanceStatus();
      setStatus(next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load server maintenance status.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

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
              Create a complete logical dump of the live database and download it for safekeeping or recovery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading || downloading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </button>
        </header>

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
      </div>
    </div>
  );
};

export default ServerMaintenanceView;
