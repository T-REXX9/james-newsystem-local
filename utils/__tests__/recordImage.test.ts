import { describe, expect, it, vi } from 'vitest';
import { RECORD_IMAGE_MAX_BYTES, readRecordImage, validateRecordImageFile } from '../recordImage';

describe('record image validation', () => {
  it('accepts supported local image formats within the limit', () => {
    expect(validateRecordImageFile(new File(['image'], 'logo.png', { type: 'image/png' }))).toBeNull();
    expect(validateRecordImageFile(new File(['image'], 'logo.webp', { type: 'image/webp' }))).toBeNull();
  });

  it('rejects unsupported files and files over 5 MB', () => {
    expect(validateRecordImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toContain('JPG');
    const oversized = new File([new Uint8Array(RECORD_IMAGE_MAX_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(validateRecordImageFile(oversized)).toContain('5 MB');
  });

  it('reads the original selected file as a data URL without re-encoding it', async () => {
    vi.stubGlobal('Image', class {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      set src(_value: string) { this.onload?.(new Event('load')); }
    });
    const file = new File(['original image bytes'], 'photo.png', { type: 'image/png' });
    const dataUrl = await readRecordImage(file);
    expect(dataUrl).toBe(`data:image/png;base64,${btoa('original image bytes')}`);
    vi.unstubAllGlobals();
  });
});
