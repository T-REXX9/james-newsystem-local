import { describe, expect, it } from 'vitest';
import {
  calculateDashboardFitScale,
  shouldRecalculateDashboardFit,
} from '../ownerDashboardViewportFit';

describe('calculateDashboardFitScale', () => {
  it('scales tall dashboard content to the available shell height', () => {
    expect(calculateDashboardFitScale(540, 960)).toBeCloseTo(0.5625, 4);
  });

  it('never enlarges content or divides by an invalid size', () => {
    expect(calculateDashboardFitScale(960, 540)).toBe(1);
    expect(calculateDashboardFitScale(0, 960)).toBe(1);
    expect(calculateDashboardFitScale(540, 0)).toBe(1);
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
