import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface ValidationSummaryProps {
  errors: Record<string, string>;
  onFieldClick?: (fieldName: string) => void;
  summaryKey?: string | number;
  severity?: 'error' | 'warning';
  onDismiss?: () => void;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  onFieldClick,
  summaryKey,
  severity = 'error',
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const errorEntries = useMemo(() => Object.entries(errors).filter(([, message]) => message), [errors]);

  useEffect(() => {
    if (errorEntries.length > 0) {
      setDismissed(false);
    }
  }, [summaryKey, errorEntries.length]);

  if (errorEntries.length === 0 || dismissed) return null;

  const isWarning = severity === 'warning';

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isWarning
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold">
            {errorEntries.length} {errorEntries.length === 1 ? 'issue' : 'issues'} found
          </div>
          <p className="text-xs mt-1 text-slate-600">
            Review the fields below and update the highlighted inputs to continue.
          </p>
          <ul className="mt-2 space-y-1">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                {onFieldClick ? (
                  <button
                    type="button"
                    onClick={() => onFieldClick(field)}
                    className="text-left text-xs underline"
                  >
                    {message}
                  </button>
                ) : (
                  <span className="text-xs">{message}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="text-xs font-semibold"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ValidationSummary;
