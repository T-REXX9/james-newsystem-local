export const calculateDashboardFitScale = (availableHeight: number, contentHeight: number): number => {
  if (availableHeight <= 0 || contentHeight <= 0) return 1;
  return Math.min(1, availableHeight / contentHeight);
};

export interface DashboardViewportSize {
  width: number;
  height: number;
}

export const shouldRecalculateDashboardFit = (
  previous: DashboardViewportSize | null,
  next: DashboardViewportSize,
  tolerance = 1
): boolean => (
  previous === null
  || Math.abs(previous.width - next.width) >= tolerance
  || Math.abs(previous.height - next.height) >= tolerance
);
