import { describe, expect, it } from 'vitest';
import { RECORD_IMAGE_MAX_BYTES, validateRecordImageFile } from '../recordImage';

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
});
