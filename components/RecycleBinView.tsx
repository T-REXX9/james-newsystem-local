import React, { useEffect, useState } from 'react';
import { RecoveryItem, getAllRecycleBinItems, restoreItem, discardRecovery } from '../services/recycleBinService';

export default function RecycleBinView() {
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{ item: RecoveryItem; action: 'restore' | 'discard' } | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getAllRecycleBinItems().then(rows => { if (active) setItems(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load recovery records'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const confirm = async () => {
    if (!confirmation) return;
    setBusy(true); setError('');
    try {
      const action = confirmation.action === 'restore' ? restoreItem : discardRecovery;
      await action(confirmation.item.id);
      setConfirmation(null); setRevision(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Recovery action failed'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-5xl space-y-5 p-6">
    <div className="flex justify-between"><h1 className="text-2xl font-bold">Recycle Bin</h1><button type="button" disabled={loading || busy} onClick={() => setRevision(n => n + 1)} className="rounded border px-3 py-2">Refresh</button></div>
    <p className="text-sm text-slate-500">Recovery is available for customer and product deletions made after local recovery was enabled. Older deletions cannot be recovered here. Discarding recovery data is irreversible; disabled product records remain for transaction history.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p role="status">Loading recovery records…</p> : !error && !items.length ? <p>No recoverable deleted records.</p> : items.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-4">
      <div><strong>{item.label || item.item_id}</strong><p className="text-sm text-slate-500">{item.item_type === 'contact' ? 'Customer' : 'Product'} · {item.deleted_at}</p></div>
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setConfirmation({ item, action: 'restore' })} className="rounded bg-blue-600 px-3 py-2 text-white">Restore</button><button type="button" disabled={busy} onClick={() => setConfirmation({ item, action: 'discard' })} className="rounded border px-3 py-2 text-red-600">Discard recovery</button></div>
    </article>)}
    {confirmation && <div role="dialog" aria-modal="true" aria-label="Confirm recovery action" className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 p-5"><div className="max-w-lg space-y-4 rounded bg-white p-6 text-slate-900">
      <h2 className="font-bold">{confirmation.action === 'restore' ? 'Restore' : 'Permanently discard recovery for'} {confirmation.item.label}?</h2>
      {confirmation.action === 'discard' && <p>This removes the saved recovery data and cannot be undone.</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void confirm()} className="mr-3 rounded bg-blue-600 px-3 py-2 text-white">Confirm</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
    </div></div>}
  </section>;
}
