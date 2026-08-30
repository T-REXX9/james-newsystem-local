import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts, getShortcutDisplay } from '../useKeyboardShortcuts';

const fireKeyDown = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useKeyboardShortcuts', () => {
    it('invokes the matching handler when a registered key is pressed', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { key: 's', ctrl: true, handler, description: 'Save' },
        ]));
        const event = fireKeyDown({ key: 's', ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('does not throw when an event with an undefined key is dispatched', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { key: 'a', handler, description: 'A' },
        ]));
        expect(() => fireKeyDown({ key: '' })).not.toThrow();
    });

    it('skips malformed shortcut entries (missing key) without throwing', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            // @ts-expect-error intentionally malformed shortcut
            { handler, description: 'broken' },
            { key: 'b', handler, description: 'B' },
        ]));
        expect(() => fireKeyDown({ key: 'b' })).not.toThrow();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('skips shortcuts that lack a callable handler', () => {
        renderHook(() => useKeyboardShortcuts([
            // @ts-expect-error intentionally malformed shortcut
            { key: 'x', description: 'broken' },
        ]));
        expect(() => fireKeyDown({ key: 'x' })).not.toThrow();
    });

    it('ignores key events when disabled', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts(
            [{ key: 's', ctrl: true, handler, description: 'Save' }],
            false
        ));
        fireKeyDown({ key: 's', ctrlKey: true });
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('getShortcutDisplay', () => {
    it('returns a Mac-styled string for ⌘ shortcuts on macOS', () => {
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
        expect(getShortcutDisplay({ key: 'k', meta: true, handler: () => {}, description: '' })).toBe('⌘K');
    });

    it('returns a Windows/Linux string with + separators on other platforms', () => {
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
        expect(getShortcutDisplay({ key: 'k', ctrl: true, handler: () => {}, description: '' })).toBe('Ctrl+K');
    });

    it('returns an empty string for malformed shortcuts instead of throwing', () => {
        // @ts-expect-error intentionally malformed shortcut
        expect(getShortcutDisplay({ handler: () => {}, description: '' })).toBe('');
        // @ts-expect-error intentionally malformed shortcut
        expect(getShortcutDisplay(null)).toBe('');
    });
});
