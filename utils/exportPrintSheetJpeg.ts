import html2canvas from 'html2canvas';

export interface ExportPrintSheetJpegOptions {
  element: HTMLElement;
  filename: string;
  quality?: number;
}

/**
 * Capture a print-sheet DOM node as a JPEG download.
 * Used so Export JPEG matches the print layout (not the editable form).
 */
export async function exportPrintSheetAsJpeg({
  element,
  filename,
  quality = 0.92,
}: ExportPrintSheetJpegOptions): Promise<void> {
  await document.fonts?.ready;

  const bounds = element.getBoundingClientRect();
  const exportWidth = Math.ceil(Math.max(element.scrollWidth, element.clientWidth, bounds.width, 1));
  const exportHeight = Math.ceil(Math.max(element.scrollHeight, element.clientHeight, bounds.height, 1));

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    width: exportWidth,
    height: exportHeight,
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(document.documentElement.clientWidth, exportWidth),
    windowHeight: Math.max(document.documentElement.clientHeight, exportHeight),
    onclone: (_document, clonedElement) => {
      clonedElement.style.width = `${exportWidth}px`;
      clonedElement.style.height = 'auto';
      clonedElement.style.minHeight = `${exportHeight}px`;
      clonedElement.style.overflow = 'visible';
      clonedElement.style.boxShadow = 'none';
      clonedElement.style.border = 'none';
      clonedElement.style.margin = '0';
      clonedElement.style.borderRadius = '0';
    },
  });

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to create JPEG image.'));
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        resolve();
      },
      'image/jpeg',
      quality
    );
  });
}

export function waitForPrintSheet(getSheet: () => HTMLElement | null, timeoutMs = 3000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const tick = () => {
      const sheet = getSheet();
      if (sheet && sheet.offsetWidth > 0 && sheet.offsetHeight > 0) {
        resolve(sheet);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Print layout was not ready for export.'));
        return;
      }
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}
