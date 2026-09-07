import { describe, it, expect } from "vitest";
import { computeDashboardMetrics, DealItem } from "../dashboard-metrics";
import { evaluateFeatureFlag } from "../../context/feature-flags-context";
import { FeatureFlag } from "../../types/feature-flags";

describe("useDashboardMetrics & computeDashboardMetrics Parity", () => {
  const sampleDeals: DealItem[] = [
    {
      id: "deal-1",
      title: "Enterprise Subscription",
      value: 100000,
      stage: "proposal",
      probability: 0.8,
      updatedAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "deal-2",
      title: "Mid-Market Expansion",
      value: 50000,
      stage: "qualification",
      probability: 0.5,
      updatedAt: "2026-09-02T10:00:00Z",
    },
    {
      id: "deal-3",
      title: "Equal Value Deal B",
      value: 50000,
      stage: "discovery",
      probability: 0.5,
      updatedAt: "2026-09-02T10:00:00Z",
    },
    {
      id: "deal-4",
      title: "Closed Deal",
      value: 30000,
      stage: "closed_won",
      probability: 1.0,
      updatedAt: "2026-08-15T10:00:00Z",
    },
    {
      id: "deal-5",
      title: "Lost Opportunity",
      value: 20000,
      stage: "closed_lost",
      probability: 0.0,
      updatedAt: "2026-08-20T10:00:00Z",
    },
  ];

  it("produces identical metrics for desktop and mobile form factors (Parity Contract)", () => {
    const desktop = computeDashboardMetrics(sampleDeals, { formFactor: "desktop" });
    const mobile = computeDashboardMetrics(sampleDeals, { formFactor: "mobile" });

    expect(desktop.totalPipelineValue).toBe(mobile.totalPipelineValue);
    expect(desktop.weightedPipelineValue).toBe(mobile.weightedPipelineValue);
    expect(desktop.winRate).toBe(mobile.winRate);
    expect(desktop.topDeals).toEqual(mobile.topDeals);
    expect(desktop.recommendedDeals).toEqual(mobile.recommendedDeals);
  });

  it("correctly calculates metrics", () => {
    const metrics = computeDashboardMetrics(sampleDeals);
    expect(metrics.totalPipelineValue).toBe(200000); // 100k + 50k + 50k
    expect(metrics.weightedPipelineValue).toBe(130000); // 80k + 25k + 25k
    expect(metrics.closedWonValue).toBe(30000);
    expect(metrics.winRate).toBe(50); // 1 won out of 2 closed
    expect(metrics.totalDealsCount).toBe(3);
  });

  it("breaks ties deterministically by ID when values and update dates match", () => {
    const metrics = computeDashboardMetrics(sampleDeals);
    expect(metrics.topDeals[1].id).toBe("deal-2");
    expect(metrics.topDeals[2].id).toBe("deal-3");
  });
});

describe("Feature Flag Evaluation Order & Precedence", () => {
  it("respects precedence: Global Disabled -> User Override -> Role Override -> Fallback", () => {
    const aiFlag: FeatureFlag = {
      key: "ai_deal_whisperer",
      enabled: true,
      denyByDefault: true,
      rollout: {
        strategy: "role",
        roles: ["admin"],
        userIds: ["special-user-1"],
      },
    };

    // User match override works
    expect(evaluateFeatureFlag(aiFlag, { id: "special-user-1", role: "bdm" })).toBe(true);

    // Role match works
    expect(evaluateFeatureFlag(aiFlag, { id: "other-user", role: "admin" })).toBe(true);

    // Unmatched user on denyByDefault AI flag is denied
    expect(evaluateFeatureFlag(aiFlag, { id: "regular-user", role: "bdm" })).toBe(false);

    // Global disabled overrides everything
    const disabledFlag: FeatureFlag = { ...aiFlag, enabled: false };
    expect(evaluateFeatureFlag(disabledFlag, { id: "special-user-1", role: "admin" })).toBe(false);
  });
});
