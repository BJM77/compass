'use server';
/**
 * @fileOverview A Genkit flow for generating an AI-powered executive summary and strategic analysis
 * of a business development team's performance, including weekly activity metrics.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExecutiveTeamSummaryInputSchema = z.object({
  week: z.string().describe("The current reporting week (YYYY-WW)."),
  teamActivity: z.object({
    totalAppointments: z.number().describe("Total face-to-face or virtual appointments this week."),
    totalCalls: z.number().describe("Total customer conversations/calls this week."),
    totalNewOpportunities: z.number().describe("Total new sales opportunities identified this week."),
  }).describe("Aggregated weekly activity metrics for the entire team."),
  teamPerformanceData: z.array(
    z.object({
      bdmName: z.string().describe("The BDM's name."),
      revenueYTD: z.number().describe("The BDM's Year-to-Date revenue."),
      target: z.number().describe("The BDM's revenue target."),
      activityScore: z.number().describe("The BDM's activity score."),
      behaviourScore: z.number().describe("The BDM's behaviour score."),
      overallScore: z.number().describe("The BDM's overall performance score."),
      recoveryStatus: z.enum(['ON_TRACK', 'RECOVERING', 'AT_RISK']).describe("The BDM's recovery status."),
    })
  ).describe("Array of individual BDM performance data for analysis."),
  teamGoals: z.array(
    z.object({
      bdmName: z.string(),
      goal: z.string(),
      status: z.string(),
    })
  ).describe("Summary of individual goals set and achieved this week."),
});
export type ExecutiveTeamSummaryInput = z.infer<typeof ExecutiveTeamSummaryInputSchema>;

const ExecutiveTeamSummaryOutputSchema = z.object({
  executiveSummary: z.string().describe("A concise executive summary of the team's overall performance for the week."),
  strategicAnalysis: z.string().describe("A strategic analysis, including key insights, actionable recommendations, and areas for improvement based on activity and results."),
  topPerformers: z.array(
    z.object({
      name: z.string().describe("The name of the top performing BDM."),
      reason: z.string().describe("Why this BDM is a top performer this week."),
    })
  ).describe("A list of top performing BDMs and reasons for their performance."),
  potentialRisks: z.string().describe("Potential risks to team performance and suggested mitigations."),
  emailSubject: z.string().describe("A professional email subject line for the GM report."),
  emailBody: z.string().describe("A professionally drafted email body for Ted Butler (GM) summarizing the week's performance."),
});
export type ExecutiveTeamSummaryOutput = z.infer<typeof ExecutiveTeamSummaryOutputSchema>;

const generateExecutiveTeamSummaryPrompt = ai.definePrompt({
  name: 'generateExecutiveTeamSummaryPrompt',
  input: {schema: ExecutiveTeamSummaryInputSchema},
  output: {schema: ExecutiveTeamSummaryOutputSchema},
  prompt: `You are an expert sales performance analyst for Team Global Express.
Your task is to analyze the provided team performance data for Week {{{week}}} and generate a comprehensive executive report for the GM, Ted Butler.

The report must include:
1.  A concise executive summary of the week's performance.
2.  A strategic analysis with key insights based on activity levels (Appointments: {{{teamActivity.totalAppointments}}}, Calls: {{{teamActivity.totalCalls}}}, New Opportunities: {{{teamActivity.totalNewOpportunities}}}).
3.  Identification of top-performing BDMs.
4.  Identification of potential risks and mitigations.
5.  A professionally drafted email to Ted Butler (ted.butler@teamglobalexp.com).

Team Performance Data:
{{json teamPerformanceData}}

Team Goals for the Week:
{{json teamGoals}}

Ensure your analysis is data-driven, insightful, and maintains a high-performance executive tone.
`,
});

const generateExecutiveTeamSummaryFlow = ai.defineFlow(
  {
    name: 'generateExecutiveTeamSummaryFlow',
    inputSchema: ExecutiveTeamSummaryInputSchema,
    outputSchema: ExecutiveTeamSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await generateExecutiveTeamSummaryPrompt(input);
    if (!output) throw new Error('AI Coach failed to generate executive team summary.');
    return output;
  }
);

export async function generateExecutiveTeamSummary(
  input: ExecutiveTeamSummaryInput
): Promise<ExecutiveTeamSummaryOutput> {
  return generateExecutiveTeamSummaryFlow(input);
}
