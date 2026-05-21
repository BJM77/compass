'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiReportInputSchema = z.object({
  week: z.string().describe("The current reporting week (YYYY-WW)."),
  group90DayPlan: z.array(
    z.object({
      task: z.string(),
      completed: z.boolean(),
    })
  ).describe("Status of tasks in the Group's 90-Day Success Plan."),
  teamPipeline: z.array(
    z.object({
      bdmName: z.string(),
      opportunityName: z.string(),
      stage: z.string(),
      value: z.number(),
    })
  ).describe("Pipeline opportunities and their values per BDM."),
  playbooks: z.record(z.string(), z.any()).describe("Active strategy playbooks and target regions for the BDMs."),
});

export type AiReportInput = z.infer<typeof AiReportInputSchema>;

const AiReportOutputSchema = z.object({
  presentationTitle: z.string().describe("A catchy, professional title for the presentation report."),
  groupPlanReview: z.string().describe("A strategic review of the Group's 90-Day Plan progress, highlighting what has been achieved and what needs focus."),
  userOpportunities: z.string().describe("A breakdown of individual user opportunities and pipeline revenue analysis, highlighting key deals."),
  strategyPlaybooks: z.string().describe("Analysis of how the team is executing against their assigned Strategy Playbooks (e.g., Metro North, Metro South)."),
  keyTakeaways: z.string().describe("Top 3-4 bullet points summarizing the most important takeaways for senior management."),
});

export type AiReportOutput = z.infer<typeof AiReportOutputSchema>;

const generateAiReportPrompt = ai.definePrompt({
  name: 'generateAiReportPrompt',
  input: { schema: AiReportInputSchema },
  output: { schema: AiReportOutputSchema },
  prompt: `You are a high-level strategic advisor generating an Executive Presentation Report for Team Global Express.
The manager will present this report to the team and senior managers for Week {{{week}}}.

Your task is to synthesize the following data into a compelling, professional, and actionable presentation script/report.

1. Group 90-Day Plan Progress:
{{json group90DayPlan}}

2. Team Pipeline & Opportunities:
{{json teamPipeline}}

3. Active Strategy Playbooks (Targeting & Focus):
{{json playbooks}}

Instructions:
- Group Plan Review: Assess the momentum of the 90-day plan. What's done? What's at risk?
- User Opportunities: Highlight strong pipeline revenue and specific BDMs who are driving value. Mention total pipeline scale if possible.
- Strategy Playbooks: Relate the pipeline success back to the playbook focuses (e.g., SME/Trade in North, DCs in South).
- Key Takeaways: Provide sharp, punchy bullet points for the final slide/summary.
- Tone: Executive, confident, data-driven, and forward-looking.
`,
});

const generateAiReportFlow = ai.defineFlow(
  {
    name: 'generateAiReportFlow',
    inputSchema: AiReportInputSchema,
    outputSchema: AiReportOutputSchema,
  },
  async (input) => {
    const { output } = await generateAiReportPrompt(input);
    if (!output) throw new Error('AI failed to generate the presentation report.');
    return output;
  }
);

export async function generateAiReport(
  input: AiReportInput
): Promise<AiReportOutput> {
  return generateAiReportFlow(input);
}
