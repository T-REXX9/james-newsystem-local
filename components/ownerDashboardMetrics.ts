export interface OwnerDashboardMetricInput {
  actualSales: number;
  monthlyTarget: number;
  categoryPotential: number[];
  calls: number;
  texts: number;
  successfulOutcomes: number;
}

export interface OwnerDashboardMetrics {
  remainingTarget: number;
  totalPotential: number;
  targetAchieved: number;
  pipelineVsTarget: number;
  conversionRate: number;
}

const percentage = (part: number, whole: number) =>
  whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;

export const buildOwnerDashboardMetrics = (
  input: OwnerDashboardMetricInput
): OwnerDashboardMetrics => {
  const totalPotential = input.categoryPotential.reduce(
    (sum, value) => sum + Math.max(0, value),
    0
  );
  const totalContactActivity = Math.max(0, input.calls) + Math.max(0, input.texts);

  return {
    remainingTarget: Math.max(0, input.monthlyTarget - input.actualSales),
    totalPotential,
    targetAchieved: percentage(input.actualSales, input.monthlyTarget),
    pipelineVsTarget: percentage(totalPotential, input.monthlyTarget),
    conversionRate: percentage(input.successfulOutcomes, totalContactActivity),
  };
};
