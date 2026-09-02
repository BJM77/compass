'use server';
/**
 * @fileOverview Business Card OCR & Parsing AI Agent using Genkit.
 * Extracts structured Lead fields from a business card photo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ParseBusinessCardInputSchema = z.object({
  photoDataUri: z.string().describe('Data URI of the business card image (e.g. data:image/jpeg;base64,...)'),
});

export type ParseBusinessCardInput = z.infer<typeof ParseBusinessCardInputSchema>;

const ParseBusinessCardOutputSchema = z.object({
  companyName: z.string().describe('Company or business name found on the card'),
  firstName: z.string().describe('First name of the person'),
  lastName: z.string().describe('Last name of the person'),
  title: z.string().describe('Job title or role'),
  phone: z.string().describe('Mobile or phone number'),
  email: z.string().describe('Email address'),
  addressLine1: z.string().describe('Street address or PO Box'),
  suburb: z.string().describe('Suburb or city'),
  state: z.string().describe('State abbreviation (e.g. WA, NSW, VIC, QLD, SA, TAS, NT, ACT)'),
  postcode: z.string().describe('Postcode'),
});

export type ParseBusinessCardOutput = z.infer<typeof ParseBusinessCardOutputSchema>;

const businessCardPrompt = ai.definePrompt({
  name: 'businessCardPrompt',
  input: { schema: ParseBusinessCardInputSchema },
  output: { schema: ParseBusinessCardOutputSchema },
  prompt: `You are an expert OCR and data extraction assistant for sales professionals.
Analyze the business card image below and extract the contact details into structured fields.

Image:
{{media url=photoDataUri}}

Guidelines:
- Extract companyName, firstName, lastName, title, phone, email, addressLine1, suburb, state, postcode.
- If a field is not found or unclear on the card, leave it as an empty string ("").
- Clean up phone numbers to standard Australian format if possible (e.g. 0412 345 678).
- Ensure state is capitalized abbreviation if in Australia (e.g. WA, VIC, NSW).`,
});

export async function parseBusinessCard(input: ParseBusinessCardInput): Promise<ParseBusinessCardOutput> {
  const { output } = await businessCardPrompt(input);
  if (!output) throw new Error('AI failed to parse the business card image.');
  return output;
}
