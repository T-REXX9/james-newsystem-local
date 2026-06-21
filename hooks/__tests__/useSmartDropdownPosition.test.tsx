import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSmartDropdownPosition } from '../useSmartDropdownPosition';

describe('useSmartDropdownPosition', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps right-edge fallback aligned to the hovered trigger instead of shifting by viewport coordinates', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);

    const offsetParent = document.createElement('div');
    const trigger = document.createElement('button');
    const dropdown = document.createElement('div');

    Object.defineProperty(dropdown, 'offsetParent', {
      configurable: true,
      get: () => offsetParent,
    });

    offsetParent.getBoundingClientRect = vi.fn(() => ({
      x: 360,
      y: 0,
      width: 140,
      height: 48,
      top: 0,
      right: 500,
      bottom: 48,
      left: 360,
      toJSON: () => ({}),
    })) as any;

    trigger.getBoundingClientRect = vi.fn(() => ({
      x: 380,
      y: 80,
      width: 100,
      height: 40,
      top: 80,
      right: 480,
      bottom: 120,
      left: 380,
      toJSON: () => ({}),
    })) as any;

    dropdown.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 550,
      height: 300,
      top: 0,
      right: 550,
      bottom: 300,
      left: 0,
      toJSON: () => ({}),
    })) as any;

    const { result } = renderHook(() =>
      useSmartDropdownPosition(trigger, dropdown, true, {
        preferredAlignment: 'center',
        offset: 16,
        padding: 16,
      })
    );

    await waitFor(() => {
      expect(result.current.right).toBe('20px');
    });

    expect(result.current.transform).toBe('none');
    expect(result.current.maxHeight).toBe('764px');
  });
});
