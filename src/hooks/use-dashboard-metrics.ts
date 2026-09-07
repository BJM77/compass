import { useMemo } from "react";
import { computeDashboardMetrics, ComputeMetricsOptions, DealItem, DashboardMetrics } from "@/lib/dashboard-metrics";

export function useDashboardMetrics(
  deals: DealItem[],
  options?: ComputeMetricsOptions
): DashboardMetrics {
  return useMemo(() => {
    return computeDashboardMetrics(deals, options);
  }, [deals, options]);
}
