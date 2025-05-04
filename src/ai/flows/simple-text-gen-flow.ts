// src/ai/flows/simple-text-gen-flow.ts
// src/ai/flows/simple-text-gen-flow.ts
'use server';
/**
 * @fileOverview A simple Genkit flow for generating text based on input.
 *
 * - generateSimpleText - A function that generates a text response to the input.
 * - SimpleTextGenInput - The input type for the generateSimpleText function.
 * - SimpleTextGenOutput - The return type for the generateSimpleText function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { getVariableValue } from '@/ai/tools/get-variable-tool'; // Import the new tool

const SimpleTextGenInputSchema = z.object({
  inputText: z.string().describe('The input text prompt for the AI. Variable values referenced with {varname} have already been substituted if found.'),
});
export type SimpleTextGenInput = z.infer<typeof SimpleTextGenInputSchema>;

const SimpleTextGenOutputSchema = z.object({
  answer: z.string().describe('The AI-generated text response.'),
});
export type SimpleTextGenOutput = z.infer<typeof SimpleTextGenOutputSchema>;


// Exported wrapper function
export async function generateSimpleText(input: SimpleTextGenInput): Promise<SimpleTextGenOutput> {
  return simpleTextGenFlow(input);
}

const simpleTextPrompt = ai.definePrompt({
  name: 'simpleTextGenPrompt',
  input: {
    schema: SimpleTextGenInputSchema,
  },
  output: {
    schema: SimpleTextGenOutputSchema,
  },
  // Provide the tool to the prompt
  tools: [getVariableValue],
  // Update prompt instructions
  prompt: `Respond directly to the following input. If the input mentions a variable name and its value seems relevant but was not provided (e.g., marked as '<variable 'varname' not found>'), use the 'getVariableValue' tool to retrieve its current value before formulating your response.

Input:
{{{inputText}}}`,
});


const simpleTextGenFlow = ai.defineFlow<
  typeof SimpleTextGenInputSchema,
  typeof SimpleTextGenOutputSchema
>(
  {
    name: 'simpleTextGenFlow',
    inputSchema: SimpleTextGenInputSchema,
    outputSchema: SimpleTextGenOutputSchema,
  },
  async (input) => {
    const { output } = await simpleTextPrompt(input);

    if (!output) {
        console.error("AI simple text generation failed to return output for input:", input.inputText);
        throw new Error("AI generation failed.");
    }

    return output;
  }
);

// Export the flow directly
export { simpleTextGenFlow };

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'simple-text-gen-flow.ts';
}
