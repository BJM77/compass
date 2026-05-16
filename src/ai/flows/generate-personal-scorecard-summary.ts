'use server';
/**
 * @fileOverview Elite Professional Sales Coaching flow. Performs deal risk scoring, pattern recognition,
 * and assesses professionalism indicators like stakeholder mapping and strategic yield.
 *
 * - generatePersonalScorecardSummary - Generates an elite coaching brief.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GeneratePersonalScorecardSummaryInputSchema = z.object({
  bdmName: z.string().describe("The name of the BDM."),
  bdmStats: z.object({
    revenueYTD: z.number(),
    target: z.number(),
    activityScore: z.number(),
    behaviourScore: z.number(),
    overallScore: z.number(),
    recoveryStatus: z.enum(['ON_TRACK', 'RECOVERING', 'AT_RISK']),
  }),
  pipelineDeals: z.array(z.object({
    account: z.string(),
    stage: z.string(),
    value: z.number(),
    daysInStage: z.number(),
    lastUpdate: z.string(),
  })).describe('Active deals to analyze for risk.'),
  weeklyTrends: z.array(z.object({
    week: z.string(),
    revenue: z.number(),
  })),
  coachingNotes: z.array(z.object({
    text: z.string(),
    createdAt: z.string(),
  })),
});

export type GeneratePersonalScorecardSummaryInput = z.infer<typeof GeneratePersonalScorecardSummaryInputSchema>;

const GeneratePersonalScorecardSummaryOutputSchema = z.object({
  summary: z.string().describe('Executive summary of the week focusing on professional mastery.'),
  topPriorities: z.array(z.string()).min(3).max(3).describe('The top 3 critical actions for this BDM for the next 48 hours.'),
  riskAlerts: z.array(z.object({
    dealName: z.string(),
    riskLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    reason: z.string(),
    mitigation: z.string(),
  })).describe('Flagged deals with high risk of stalling or single-threaded stakeholders.'),
  behavioralInsights: z.array(z.string()).describe('Pattern recognition observations regarding professionalism.'),
  oneOnOneTalkingPoints: z.array(z.string()).describe('Elite conversation starters for the manager.'),
});

export type GeneratePersonalScorecardSummaryOutput = z.infer<typeof GeneratePersonalScorecardSummaryOutputSchema>;

const personalScorecardSummaryPrompt = ai.definePrompt({
  name: 'personalScorecardSummaryPrompt',
  input: { schema: GeneratePersonalScorecardSummaryInputSchema },
  output: { schema: GeneratePersonalScorecardSummaryOutputSchema },
  prompt: `You are an elite Executive Sales Coach for a world-class industrial BDM team.
Your goal is to transition this rep from a "Sales Person" to a "Sales Professional."

Analyze the performance of {{{bdmName}}}.

1. **Strategic Yield Assessment**: Evaluate Revenue per Activity. (Low Yield = Too many calls with no value. High Yield = Precision targeting).
2. **Professionalism Factors**: Look for "Single-Threaded" risks (deals where only one stakeholder is mentioned).
3. **Velocity Audit**: Identify deals stalling in Discovery for >14 days. Professionals "Fail Fast."
4. **Actionable Priorities**: Identify 3 specific actions the BDM must take to protect their forecast.

---START OF DATA---
BDM Statistics:
{{json bdmStats}}

Pipeline Activity:
{{#each pipelineDeals}}
- Account: {{account}} | Stage: {{stage}} | Value: {{value}} | Days in Stage: {{daysInStage}}
{{/each}}

Trends & Notes:
{{json weeklyTrends}}
{{json coachingNotes}}
---END OF DATA---

Your output must be sophisticated, data-driven, and focus on elite performance standards.`,
});

const generatePersonalScorecardSummaryFlow = ai.defineFlow(
  {
    name: 'generatePersonalScorecardSummaryFlow',
    inputSchema: GeneratePersonalScorecardSummaryInputSchema,
    outputSchema: GeneratePersonalScorecardSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await personalScorecardSummaryPrompt(input);
    if (!output) throw new Error('AI Coach failed to generate brief.');
    return output;
  }
);

export async function generatePersonalScorecardSummary(input: GeneratePersonalScorecardSummaryInput): Promise<GeneratePersonalScorecardSummaryOutput> {
  return generatePersonalScorecardSummaryFlow(input);
}
