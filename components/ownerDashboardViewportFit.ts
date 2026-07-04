interface DashboardFitScaleOptions {
  availableWidth: number;
  availableHeight: number;
  contentWidth: number;
  contentHeight: number;
  maxScale?: number;
}

export const calculateDashboardFitScale = ({
  availableWidth,
  availableHeight,
  contentWidth,
  contentHeight,
  maxScale = 1.35,
}: DashboardFitScaleOptions): number => {
  if (availableWidth <= 0 || availableHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return 1;

  const widthScale = availableWidth / contentWidth;
  if (widthScale > 1) {
    return Math.min(widthScale, maxScale);
  }

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
