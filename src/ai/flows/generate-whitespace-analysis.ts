'use server';
/**
 * @fileOverview Strategic Whitespace Analysis AI agent.
 * Performs deep-dive analysis on account expansion opportunities.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const WhitespaceAnalysisInputSchema = z.object({
  accountName: z.string().describe('The name of the account to analyze.'),
  currentServices: z.array(z.string()).describe('Services the customer currently uses.'),
  accountSummary: z.string().optional().describe('Brief context about the account history.'),
  territory: z.string().optional(),
});

export type WhitespaceAnalysisInput = z.infer<typeof WhitespaceAnalysisInputSchema>;

const WhitespaceAnalysisOutputSchema = z.object({
  executiveSummary: z.string(),
  definition: z.string(),
  analysisFramework: z.string(),
  cellStates: z.array(z.object({
    state: z.enum(['EXPAND', 'MAINTAIN', 'TARGET', 'WHITE_SPACE']),
    description: z.string(),
    action: z.string()
  })),
  narrativeMatrix: z.string().describe('A narrative description of the service coverage.'),
  keyInsights: z.array(z.string()),
  priorityOpportunityZones: z.array(z.object({
    service: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    rationale: z.string(),
    guidance: z.enum(['PURSUE', 'PARK', 'PASS'])
  })),
  practitionerPlaybook: z.string(),
  commonMistakes: z.array(z.string()),
  conclusion: z.string()
});

export type WhitespaceAnalysisOutput = z.infer<typeof WhitespaceAnalysisOutputSchema>;

const whitespacePrompt = ai.definePrompt({
  name: 'whitespacePrompt',
  input: { schema: WhitespaceAnalysisInputSchema },
  output: { schema: WhitespaceAnalysisOutputSchema },
  prompt: `You are a senior enterprise sales strategist and revenue operations expert.
Your task is to create a Whitespace Analysis Report for {{{accountName}}}.

Focus on identifying unearned revenue opportunities inside this account for these five service lines:
- Road
- Air
- B2C
- International
- Courier

Current Context:
Current Services: {{#each currentServices}}{{this}}, {{/each}}
Account Summary: {{{accountSummary}}}

Objectives:
1. Identify where revenue exists today vs what could be sold.
2. Surface cross-sell, upsell, and expansion opportunities.
3. Prioritise opportunities using a white space matrix.
4. Move from insight to action.

Tone: Clear, commercial, and strategic. Avoid jargon unless explained.
Output must follow the structured schema for high-fidelity rendering.`,
});

export async function generateWhitespaceAnalysis(input: WhitespaceAnalysisInput): Promise<WhitespaceAnalysisOutput> {
  const { output } = await whitespacePrompt(input);
  if (!output) throw new Error('AI failed to generate whitespace report.');
  return output;
}
