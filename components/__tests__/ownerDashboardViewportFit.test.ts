import { describe, expect, it } from 'vitest';
import {
  calculateDashboardFitScale,
  shouldRecalculateDashboardFit,
} from '../ownerDashboardViewportFit';

describe('calculateDashboardFitScale', () => {
  it('scales tall dashboard content to the available shell height', () => {
    expect(calculateDashboardFitScale({
      availableWidth: 1000,
      availableHeight: 540,
      contentWidth: 1200,
      contentHeight: 960,
    })).toBeCloseTo(0.5625, 4);
  });

  it('enlarges dashboard content on wide screens up to the configured maximum', () => {
    expect(calculateDashboardFitScale({
      availableWidth: 2400,
      availableHeight: 900,
      contentWidth: 1440,
      contentHeight: 760,
      maxScale: 1.42,
    })).toBe(1.42);
  });

  it('does not divide by an invalid size', () => {
    expect(calculateDashboardFitScale({
      availableWidth: 0,
      availableHeight: 960,
      contentWidth: 1200,
      contentHeight: 540,
    })).toBe(1);
    expect(calculateDashboardFitScale({
      availableWidth: 1000,
      availableHeight: 540,
      contentWidth: 1200,
      contentHeight: 0,
    })).toBe(1);
  });

  it('recalculates only when the viewport itself materially changes', () => {
    expect(shouldRecalculateDashboardFit(null, { width: 1280, height: 600 })).toBe(true);
    expect(
      shouldRecalculateDashboardFit(
        { width: 1280, height: 600 },
        { width: 1280.4, height: 600.4 }
      )
    ).toBe(false);
    expect(
      shouldRecalculateDashboardFit(
        { width: 1280, height: 600 },
        { width: 1366, height: 600 }
      )
    ).toBe(true);
  });
});
