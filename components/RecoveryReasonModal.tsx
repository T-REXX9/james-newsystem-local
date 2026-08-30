import React, { useEffect, useState } from 'react';

type RecoveryReasonModalProps = {
  isOpen: boolean;
  action: 'unpost' | 'delete';
  recordLabel: string;
  description: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

const RecoveryReasonModal: React.FC<RecoveryReasonModalProps> = ({ isOpen, action, recordLabel, description, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;
  const verb = action === 'unpost' ? 'Unpost' : 'Delete';
  const submit = async () => {
    const value = reason.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onConfirm(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="recovery-reason-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="recovery-reason-title" className="text-lg font-bold text-slate-900">{verb} {recordLabel}</h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="recovery-reason">Reason <span className="text-rose-600">*</span></label>
        <textarea id="recovery-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} autoFocus className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Describe why this recovery action is required." />
        <p className="mt-1 text-right text-xs text-slate-500">{reason.length}/500</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={!reason.trim() || saving} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${action === 'delete' ? 'bg-rose-600' : 'bg-amber-500'}`}>{saving ? 'Saving…' : verb}</button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryReasonModal;
