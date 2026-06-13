import { PipelineReview, FactFindingDoc } from '@/types/crm';
import { differenceInDays, parseISO } from 'date-fns';

export interface DealHealthDetails {
  score: number;
  breakdown: {
    activity: number;
    stage: number;
    factFinding: number;
    callPlan: number;
    whitespace: number;
  };
  alerts: string[];
  positives: string[];
}

export function calculateDealHealth(
  deal: PipelineReview,
  factFindings: FactFindingDoc[],
  callPlans: any[],
  whitespacePlans: any[]
): DealHealthDetails {
  let activityScore = 0;
  let stageScore = 0;
  let factFindingScore = 0;
  let callPlanScore = 0;
  let whitespaceScore = 0;

  const alerts: string[] = [];
  const positives: string[] = [];

  const dealNameUpper = (deal.pipeline || '').toUpperCase();
  const oppNameUpper = (deal.opportunityName || '').toUpperCase();

  // 1. Days since last activity (25%)
  let daysSinceLastActivity = 999;
  if (deal.lastActivity) {
    try {
      const parsedDate = parseISO(deal.lastActivity);
      daysSinceLastActivity = differenceInDays(new Date(), parsedDate);
    } catch (e) {
      // ignore
    }
  }

  if (daysSinceLastActivity <= 7) {
    activityScore = 25;
    positives.push("Active momentum (last activity within 7 days)");
  } else if (daysSinceLastActivity <= 14) {
    activityScore = 18;
    positives.push("Activity within 14 days");
  } else if (daysSinceLastActivity <= 30) {
    activityScore = 10;
    alerts.push("Warning: No activity in past 14 days");
  } else {
    activityScore = 0;
    alerts.push("Critical: Stalled activity (no updates for over 30 days)");
  }

  // 2. Days in stage vs average (25%)
  const daysInStage = Number(deal.daysInStage) || 0;
  if (daysInStage <= 15) {
    stageScore = 25;
    positives.push("Healthy progression (less than 15 days in current stage)");
  } else if (daysInStage <= 30) {
    stageScore = 20;
    positives.push("Standard progression (under 30 days in stage)");
  } else if (daysInStage <= 45) {
    stageScore = 15;
    alerts.push("Warning: Approaching stage threshold (over 30 days in stage)");
  } else if (daysInStage <= 60) {
    stageScore = 10;
    alerts.push("Warning: Stalled stage status (over 45 days in stage)");
  } else {
    stageScore = 0;
    alerts.push("Critical: Highly stalled deal (over 60 days in stage)");
  }

  // 3. Fact Finding completeness (20%)
  const ffMatch = factFindings.find(ff => {
    const ffName = (ff.companyName || '').toUpperCase();
    return ffName && (ffName === dealNameUpper || ffName === oppNameUpper);
  });

  if (ffMatch) {
    let populatedFieldsCount = 0;
    const keyFields = [
      ffMatch.businessDetails,
      ffMatch.currentlyUsing,
      ffMatch.locations,
      ffMatch.waPercentage,
      ffMatch.overnightPercentage,
      ffMatch.deliveryExpectation
    ];

    keyFields.forEach(field => {
      if (field && String(field).trim().length > 0) {
        populatedFieldsCount++;
      }
    });

    factFindingScore = 10 + (populatedFieldsCount * 1.6); // Base 10 + scale up to 20
    factFindingScore = Math.min(20, Math.round(factFindingScore));
    
    if (populatedFieldsCount >= 4) {
      positives.push("Comprehensive Fact Finding logged");
    } else {
      alerts.push("Fact Finding exists but details are incomplete");
    }
  } else {
    factFindingScore = 0;
    alerts.push("Missing Fact Finding: Deal requires discovery log");
  }

  // 4. Call Plan preparation (15%)
  const cpMatch = callPlans.find(cp => {
    const cpName = (cp.accountName || '').toUpperCase();
    return cpName && (cpName === dealNameUpper || cpName === oppNameUpper);
  });

  if (cpMatch) {
    callPlanScore = 15;
    positives.push("Call Plan professionally prepared");
  } else {
    callPlanScore = 0;
    alerts.push("No active Call Plan registered for this deal");
  }

  // 5. White Space opportunities (15%)
  const wpMatch = whitespacePlans.find(wp => {
    const wpName = (wp.accountName || '').toUpperCase();
    return wpName && (wpName === dealNameUpper || wpName === oppNameUpper);
  });

  if (wpMatch) {
    whitespaceScore = 15;
    positives.push("Whitespace Analysis archived");
  } else {
    whitespaceScore = 0;
    alerts.push("Whitespace Diagnostic pending for expansion mapping");
  }

  const score = activityScore + stageScore + factFindingScore + callPlanScore + whitespaceScore;

  return {
    score,
    breakdown: {
      activity: activityScore,
      stage: stageScore,
      factFinding: factFindingScore,
      callPlan: callPlanScore,
      whitespace: whitespaceScore
    },
    alerts,
    positives
  };
}
