import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const HISTORY_KEY = '__recordImageLightbox';

interface RecordImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const RecordImageLightbox: React.FC<RecordImageLightboxProps> = ({ src, alt, isOpen, onOpen, onClose }) => {
  const ownsHistoryEntry = useRef(false);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const requestClose = () => {
    if (ownsHistoryEntry.current && history.state?.[HISTORY_KEY]) history.back();
    else onCloseRef.current();
  };

  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onClose, onOpen]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const marker = Boolean(event.state?.[HISTORY_KEY]);
      if (marker) {
        ownsHistoryEntry.current = true;
        onOpenRef.current();
      } else if (ownsHistoryEntry.current) {
        ownsHistoryEntry.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    if (history.state?.[HISTORY_KEY]) {
      ownsHistoryEntry.current = true;
    } else if (!ownsHistoryEntry.current) {
      const marker = { ...(history.state || {}), [HISTORY_KEY]: true };
      history.pushState(marker, '');
      ownsHistoryEntry.current = true;
    }
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen || !src) return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/90 p-3 sm:p-8" onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }} onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-full max-w-full items-center justify-center">
        <h2 id={titleId} className="sr-only">Full customer image</h2>
        <button ref={closeButtonRef} type="button" onClick={requestClose} aria-label="Close full image" className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-2 text-slate-800 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:right-2 sm:top-2"><X className="h-5 w-5" /></button>
        <img src={src} alt={alt} className="max-h-[92vh] max-w-[94vw] object-contain" />
      </div>
    </div>,
    document.body
  );
};

export default RecordImageLightbox;
