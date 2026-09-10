import React, { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { optimizeRecordImage, RECORD_IMAGE_ACCEPT, validateRecordImageFile } from '../utils/recordImage';

interface RecordImagePickerProps {
  value?: string;
  onChange: (value: string) => void;
  position?: string;
  onPositionChange?: (value: string) => void;
  label?: string;
}

const RecordImagePicker: React.FC<RecordImagePickerProps> = ({ value, onChange, position, onPositionChange, label = 'Record image' }) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [cropPosition, setCropPosition] = useState(() => {
    const [x, y] = String(position || '50,50').split(',').map(Number);
    return { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 };
  });
  useEffect(() => {
    const [x, y] = String(position || '50,50').split(',').map(Number);
    setCropPosition({ x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 });
  }, [position]);
  const updatePosition = (next: { x: number; y: number }) => {
    setCropPosition(next);
    onPositionChange?.(`${next.x},${next.y}`);
  };

  const selectFile = async (file?: File) => {
    if (!file) return;
    const validationError = validateRecordImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setError('');
      onChange(await optimizeRecordImage(file));
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Unable to process the selected image.');
    }
  };

  const selectFiles = async (files: FileList | File[]) => {
    if (files.length > 1) {
      setError('Choose or drop only one record image.');
      return;
    }
    await selectFile(files[0]);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="label">{label}</label>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Choose ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFiles(event.dataTransfer.files); }}
        className={`relative flex min-h-[150px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
      >
        {value ? (
          <img src={value} alt="Selected record image preview" className="h-36 w-36 rounded-lg object-cover" style={{ objectPosition: `${cropPosition.x}% ${cropPosition.y}%` }} />
        ) : (
          <div className="text-center text-sm text-slate-500"><ImagePlus className="mx-auto mb-2 h-8 w-8" /><span>Choose an image or drag and drop it here</span></div>
        )}
        <input ref={inputRef} id={inputId} type="file" accept={RECORD_IMAGE_ACCEPT} className="sr-only" onChange={(event) => { void selectFiles(event.target.files || []); event.currentTarget.value = ''; }} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700" onClick={() => inputRef.current?.click()}>Choose file</button>
        <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700" onClick={() => cameraInputRef.current?.click()}>Take photo</button>
        <input ref={cameraInputRef} type="file" accept={RECORD_IMAGE_ACCEPT} capture="environment" className="sr-only" onChange={(event) => { void selectFiles(event.target.files || []); event.currentTarget.value = ''; }} />
      </div>
      {value && <div className="flex items-center gap-3 text-xs text-slate-600">
        <label>Horizontal crop <input aria-label="Horizontal crop" type="range" min="0" max="100" value={cropPosition.x} onChange={(event) => updatePosition({ ...cropPosition, x: Number(event.target.value) })} /></label>
        <label>Vertical crop <input aria-label="Vertical crop" type="range" min="0" max="100" value={cropPosition.y} onChange={(event) => updatePosition({ ...cropPosition, y: Number(event.target.value) })} /></label>
        <button type="button" className="inline-flex items-center gap-1 text-rose-600" onClick={() => { onChange(''); setError(''); }}><Trash2 className="h-4 w-4" /> Remove</button>
      </div>}
      {error && <div role="alert" className="text-xs text-rose-600">{error}</div>}
      <p className="text-[11px] text-slate-500">JPG, PNG, or WebP up to 5 MB. Optional.</p>
    </div>
  );
};

export default RecordImagePicker;
