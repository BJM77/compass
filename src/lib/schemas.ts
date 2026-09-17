import { z } from 'zod';

/**
 * Zod Schemas for Core Firestore Collections
 * Provides runtime validation before persistence to eliminate silent data corruption.
 */

export const PipelineReviewSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().optional(),
  state: z.string().optional(),
  week: z.string().min(1, 'Week is required'),
  accountMasterCode: z.string().optional(),
  salesforceId: z.string().optional(),
  pipeline: z.string().default(''),
  opportunityName: z.string().optional(),
  stage: z.string().default('Discovery'),
  value: z.number().default(0),
  probability: z.number().optional(),
  expectedDate: z.string().optional(),
  businessUnit: z.string().optional(),
  currentRevenue: z.number().optional(),
  lastYearRevenue: z.number().optional(),
  lastInvoiceDate: z.string().optional(),
  lastActivity: z.string().optional(),
  creditHold: z.string().optional(),
  closedWonValue: z.number().optional(),
  isBareAccount: z.boolean().default(false),
  lastSalesStageChangeDate: z.string().optional(),
  age: z.number().optional(),
  daysInStage: z.number().default(0),
  rolloverCount: z.number().default(0),
  barriers: z.string().optional(),
  lastBarrierText: z.string().optional(),
  starred: z.boolean().optional(),
  notes: z.string().optional(),
  isReviewSelected: z.boolean().default(false),
  actionsForBen: z.string().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional()
});

export const TwiwSubmissionSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  salespersonName: z.string().optional(),
  week: z.string().min(1, 'Week key is required'),
  state: z.string().default('WA'),
  wins: z.array(z.any()).default([]),
  risks: z.array(z.any()).default([]),
  updates: z.string().default(''),
  majorUpdates: z.array(z.any()).default([]),
  projectedWins: z.array(z.any()).default([]),
  priorities: z.array(z.any()).default([]),
  nextWeekActions: z.array(z.string()).default([]),
  nextWeekRoadblocks: z.string().default(''),
  nextWeekSupport: z.string().default(''),
  updatedAt: z.any().optional(),
  submittedAt: z.any().optional()
});

export const FactFindingDocSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  companyName: z.string().min(1, 'Company name is required'),
  businessDetails: z.string().default(''),
  currentlyUsing: z.string().default(''),
  keyDecisionMaker: z.string().optional(),
  incumbentCompetitor: z.string().optional(),
  contractEndDate: z.string().optional(),
  businessModel: z.string().default(''),
  freightType: z.string().default(''),
  freightSize: z.string().default(''),
  weeklyAmount: z.string().default(''),
  locations: z.string().default(''),
  waPercentage: z.string().default(''),
  overnightPercentage: z.string().default(''),
  hasData: z.boolean().default(false),
  perfectWorld: z.string().default(''),
  deliveryExpectation: z.string().default(''),
  wholesaleCharges: z.string().default(''),
  urgentDeliveries: z.string().default(''),
  securityConcern: z.boolean().default(false),
  highValueFreight: z.boolean().default(false),
  dangerousGoods: z.boolean().default(false),
  currentCustomer: z.boolean().default(false),
  reasonDownTrading: z.string().default(''),
  lastFaceToFaceMeeting: z.string().default(''),
  nextFaceToFaceMeeting: z.string().default(''),
  whatCouldWeDo: z.string().default(''),
  internationalFreight: z.boolean().default(false),
  internationalType: z.string().default(''),
  internationalSize: z.string().default(''),
  painPoints: z.string().default(''),
  specialHandling: z.string().default(''),
  loadingDock: z.string().default(''),
  seasonalFluctuations: z.string().default(''),
  tradingTerms: z.string().default(''),
  selectedServices: z.array(z.string()).default([]),
  selectedStates: z.array(z.string()).default([]),
  mapDirection: z.enum(['TO', 'FROM']).default('FROM'),
  selectedStatesFrom: z.array(z.string()).optional(),
  selectedStatesTo: z.array(z.string()).optional(),
  mapNotesFrom: z.string().optional(),
  mapNotesTo: z.string().optional(),
  serviceNotes: z.record(z.string()).optional(),
  serviceAdminNotes: z.record(z.string()).optional(),
  serviceSpendBands: z.record(z.string()).optional(),
  currentNote: z.string().optional(),
  archivedNotes: z.array(z.any()).optional(),
  inSalesforce: z.boolean().optional(),
  linkedCallPlanId: z.string().optional(),
  isArchived: z.boolean().default(false),
  stage: z.string().default('New'),
  createdAt: z.any().optional(),
  lastModifiedAt: z.any().optional()
});

/**
 * Helper to validate data before saving to Firestore.
 * Returns parsed, sanitized data or logs a warning and returns original payload to avoid blocking.
 */
export function validateDocument<T>(schema: z.ZodSchema<T>, data: unknown, docType: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[Validation Warning: ${docType}]`, result.error.format());
    return data as T;
  }
  return result.data;
}
