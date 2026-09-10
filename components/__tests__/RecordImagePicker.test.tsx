import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordImagePicker from '../RecordImagePicker';

afterEach(() => cleanup());

describe('RecordImagePicker', () => {
  it('supports the local file picker and drag-and-drop contract', () => {
    const onChange = vi.fn();
    render(<RecordImagePicker onChange={onChange} />);
    expect(screen.getByRole('button', { name: /choose record image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('rejects a non-image without changing the current selection', () => {
    const onChange = vi.fn();
    render(<RecordImagePicker value="data:image/jpeg;base64,old" onChange={onChange} />);
    const dropTarget = screen.getByRole('button', { name: /choose record image/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [new File(['text'], 'bad.txt', { type: 'text/plain' })] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/JPG/);
  });
});
