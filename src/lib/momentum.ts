export type MomentumScore = 'DEAD' | 'STALLING' | 'MOVING' | 'HOT';

export function computeMomentum(deal: {
  daysInStage: number;
  rolloverCount: number;
  barrierText: string;
  lastBarrierText: string;
}): { score: MomentumScore; reason: string; color: string; bg: string } {
  // logic: Rolled over 3+ weeks with no change in barriers is a dead deal
  if (deal.rolloverCount >= 3 && deal.barrierText === deal.lastBarrierText && deal.barrierText !== '') {
    return { 
      score: 'DEAD', 
      reason: 'Rolled over 3+ weeks, barriers unchanged',
      color: 'text-destructive',
      bg: 'bg-danger-soft border-destructive/25'
    };
  }

  if (deal.daysInStage > 21) {
    return { 
      score: 'STALLING', 
      reason: `${deal.daysInStage} days in stage`,
      color: 'text-warning-ink',
      bg: 'bg-warning-soft border-warning/25'
    };
  }

  if (deal.daysInStage < 7) {
    return { 
      score: 'HOT', 
      reason: 'Recent activity detected',
      color: 'text-success-ink',
      bg: 'bg-success-soft border-success/25'
    };
  }

  return { 
    score: 'MOVING', 
    reason: 'Normal progression',
    color: 'text-info',
    bg: 'bg-info-soft border-info/25'
  };
}