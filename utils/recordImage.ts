export const RECORD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const RECORD_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const validateRecordImageFile = (file: File): string | null => {
  if (!allowedTypes.has(file.type)) return 'Record images must be JPG, PNG, or WebP files.';
  if (file.size > RECORD_IMAGE_MAX_BYTES) return 'Record images must be 5 MB or smaller.';
  return null;
};

export const optimizeRecordImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.onload = () => {
    const source = new Image();
    source.onerror = () => reject(new Error('Unable to decode the selected image.'));
    source.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Your browser cannot process this image.'));
        return;
      }
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', 0.86);
      resolve(result);
    };
    source.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});
