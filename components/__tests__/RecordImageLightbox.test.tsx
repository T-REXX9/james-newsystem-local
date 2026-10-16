import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordImageLightbox from '../RecordImageLightbox';

afterEach(() => cleanup());

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('RecordImageLightbox', () => {
  it('opens one Back-dismissible history entry in Strict Mode and closes from its button', async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<React.StrictMode><RecordImageLightbox src="data:image/png;base64,abc" alt="Customer image" isOpen onOpen={onOpen} onClose={onClose} /></React.StrictMode>);

    expect(await screen.findByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
    expect(window.history.state.__recordImageLightbox).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close full image' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.history.state?.__recordImageLightbox).toBeUndefined());
  });

  it('closes on Escape without letting the key reach an underlying modal', async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const parentEscape = vi.fn();
    window.addEventListener('keydown', parentEscape);
    render(<RecordImageLightbox src="data:image/png;base64,abc" alt="Customer image" isOpen onOpen={onOpen} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Full customer image' }), { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(parentEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', parentEscape);
  });

  it('restores the lightbox on Forward after Back closes it', async () => {
    const Harness = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      return <RecordImageLightbox
        src="data:image/png;base64,abc"
        alt="Customer image"
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
      />;
    };
    render(<Harness />);

    expect(await screen.findByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Full customer image' })).not.toBeInTheDocument());

    await act(async () => { window.history.forward(); });
    expect(await screen.findByRole('dialog', { name: 'Full customer image' })).toBeInTheDocument();
  });
});
