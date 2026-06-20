import { describe, expect, it } from 'vitest';
import { buildOwnerDashboardMetrics } from '../ownerDashboardMetrics';

describe('buildOwnerDashboardMetrics', () => {
  it('derives remaining target and pipeline percentage', () => {
    const result = buildOwnerDashboardMetrics({
      actualSales: 685_445,
      monthlyTarget: 3_000_000,
      categoryPotential: [2_200_000, 1_890_000, 365_000, 1_205_000],
      calls: 387,
      texts: 241,
      successfulOutcomes: 73,
    });

    expect(result.remainingTarget).toBe(2_314_555);
    expect(result.totalPotential).toBe(5_660_000);
    expect(result.pipelineVsTarget).toBeCloseTo(188.67, 2);
    expect(result.conversionRate).toBeCloseTo(11.62, 2);
  });

  it('returns safe zero percentages when target and activity are zero', () => {
    const result = buildOwnerDashboardMetrics({
      actualSales: 0,
      monthlyTarget: 0,
      categoryPotential: [],
      calls: 0,
      texts: 0,
      successfulOutcomes: 0,
    });

    expect(result.remainingTarget).toBe(0);
    expect(result.pipelineVsTarget).toBe(0);
    expect(result.conversionRate).toBe(0);
  });
});
