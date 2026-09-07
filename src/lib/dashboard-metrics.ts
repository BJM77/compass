export interface DealItem {
  id: string;
  title: string;
  value: number;
  stage: "qualification" | "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  probability: number; // 0 to 1
  assignedTo?: string;
  updatedAt: string;
  createdDate?: string;
}

export interface DashboardMetrics {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  totalDealsCount: number;
  closedWonValue: number;
  winRate: number;
  topDeals: DealItem[];
  recommendedDeals: DealItem[];
}

export interface ComputeMetricsOptions {
  formFactor?: "desktop" | "mobile";
  topLimit?: number;
}

/**
 * Pure calculation function for computing dashboard KPI metrics.
 * Ensures deterministic tie-breaking and 100% parity between Desktop and Mobile.
 */
export function computeDashboardMetrics(
  deals: DealItem[],
  options: ComputeMetricsOptions = {}
): DashboardMetrics {
  const { topLimit = 5 } = options;

  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  let closedWonValue = 0;
  let closedWonCount = 0;
  let closedLostCount = 0;

  const activeDeals: DealItem[] = [];

  for (const deal of deals) {
    if (deal.stage === "closed_won") {
      closedWonValue += deal.value;
      closedWonCount += 1;
    } else if (deal.stage === "closed_lost") {
      closedLostCount += 1;
    } else {
      totalPipelineValue += deal.value;
      weightedPipelineValue += deal.value * deal.probability;
      activeDeals.push(deal);
    }
  }

  const totalClosed = closedWonCount + closedLostCount;
  const winRate = totalClosed > 0 ? (closedWonCount / totalClosed) * 100 : 0;

  // Deterministic sorting for topDeals: Value (desc) -> updatedAt (desc) -> id (asc)
  const topDeals = [...activeDeals]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return a.id.localeCompare(b.id);
    })
    .slice(0, topLimit);

  // Deterministic recommendations: Weighted Value (desc) -> id (asc)
  const recommendedDeals = [...activeDeals]
    .sort((a, b) => {
      const weightA = a.value * a.probability;
      const weightB = b.value * b.probability;
      if (weightB !== weightA) return weightB - weightA;
      return a.id.localeCompare(b.id);
    })
    .slice(0, topLimit);

  return {
    totalPipelineValue,
    weightedPipelineValue,
    totalDealsCount: activeDeals.length,
    closedWonValue,
    winRate: Math.round(winRate * 10) / 10,
    topDeals,
    recommendedDeals,
  };
}
