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
      color: 'text-red-700',
      bg: 'bg-red-100 border-red-200'
    };
  }

  if (deal.daysInStage > 21) {
    return { 
      score: 'STALLING', 
      reason: `${deal.daysInStage} days in stage`,
      color: 'text-orange-700',
      bg: 'bg-orange-100 border-orange-200'
    };
  }

  if (deal.daysInStage < 7) {
    return { 
      score: 'HOT', 
      reason: 'Recent activity detected',
      color: 'text-green-700',
      bg: 'bg-green-100 border-green-200'
    };
  }

  return { 
    score: 'MOVING', 
    reason: 'Normal progression',
    color: 'text-blue-700',
    bg: 'bg-blue-100 border-blue-200'
  };
}