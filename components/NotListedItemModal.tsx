import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export interface NotListedItemDraft {
  part_no: string;
  description: string;
  qty: number | '';
}

interface NotListedItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (draft: NotListedItemDraft) => void;
}

const NotListedItemModal: React.FC<NotListedItemModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [draft, setDraft] = useState<NotListedItemDraft>({ part_no: '', description: '', qty: 1 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const productNoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ part_no: '', description: '', qty: 1 });
    setErrors({});
    const focusTimer = window.setTimeout(() => productNoRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  if (!isOpen) return null;

  const updateDraft = (field: keyof NotListedItemDraft, value: string | number) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.part_no.trim()) nextErrors.part_no = 'Please enter a Product No.';
    if (!draft.description.trim()) nextErrors.description = 'Please enter a description.';
    if (draft.qty === '' || !Number.isFinite(Number(draft.qty)) || Number(draft.qty) <= 0) {
      nextErrors.qty = 'Please enter a valid quantity greater than 0.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onConfirm({
      part_no: draft.part_no.trim(),
      description: draft.description.trim(),
      qty: Number(draft.qty),
    });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <div className="absolute inset-0 bg-slate-900/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} />
      <div role="dialog" aria-modal="true" aria-labelledby="not-listed-item-modal-title" className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="not-listed-item-modal-title" className="text-lg font-semibold text-slate-900">Add Not Listed Product</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-5 py-5">
            <label className="block text-sm font-medium text-slate-700">
              Product No.
              <input
                ref={productNoRef}
                aria-invalid={Boolean(errors.part_no)}
                aria-describedby={errors.part_no ? 'not-listed-product-no-error' : undefined}
                value={draft.part_no}
                onChange={(event) => updateDraft('part_no', event.target.value.toUpperCase())}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
              {errors.part_no && <span id="not-listed-product-no-error" className="mt-1 block text-xs text-rose-600">{errors.part_no}</span>}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <input
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'not-listed-description-error' : undefined}
                value={draft.description}
                onChange={(event) => updateDraft('description', event.target.value.toUpperCase())}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
              {errors.description && <span id="not-listed-description-error" className="mt-1 block text-xs text-rose-600">{errors.description}</span>}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Qty
              <input
                type="number"
                min="1"
                aria-invalid={Boolean(errors.qty)}
                aria-describedby={errors.qty ? 'not-listed-qty-error' : undefined}
                value={draft.qty}
                onChange={(event) => updateDraft('qty', event.target.value === '' ? '' : Number(event.target.value))}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
              {errors.qty && <span id="not-listed-qty-error" className="mt-1 block text-xs text-rose-600">{errors.qty}</span>}
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Add Item</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default NotListedItemModal;
