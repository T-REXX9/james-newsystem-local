import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface FieldHelpProps {
  text: string;
  example?: string;
  className?: string;
}

const FieldHelp: React.FC<FieldHelpProps> = ({ text, example, className }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`mt-1 text-xs text-slate-500 ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
      >
        <Info className="w-3 h-3" />
        <span>{open ? 'Hide help' : 'Show help'}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm">
          <div>{text}</div>
          {example && <div className="mt-1 text-slate-500">Example: {example}</div>}
        </div>
      )}
    </div>
  );
};

export default FieldHelp;
