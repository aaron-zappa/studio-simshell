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
// Removed: import { getVariableValue } from '@/ai/tools/get-variable-tool'; // Remove tool import

const SimpleTextGenInputSchema = z.object({
  inputText: z.string().describe('The user\'s input text. Variable values referenced with {varname} may have already been substituted. If a variable was not found, it might appear as `<variable \'varname\' not found>`.'),
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
  // Remove the tool from the prompt
  // tools: [getVariableValue],
  // Simplify prompt instructions
  prompt: `Carefully analyze the following user input and generate a helpful response.

Sometimes, the input text might refer to variables using curly braces like {varname}. The system tries to substitute these with their stored values beforehand. If a variable was not found during substitution, it might appear as "<variable 'varname' not found>" in the input.

Respond directly and concisely based on the provided input.

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
    // Call the prompt without the tool
    const { output } = await simpleTextPrompt(input);

    if (!output) {
        console.error("AI simple text generation failed to return output for input:", input.inputText);
        throw new Error("AI generation failed.");
    }

    // Remove post-processing logic related to the tool
    // const variableNotFoundPatterns = [ ... ];
    // let variableName: string | null = null;
    // const variableMentionRegex = /variable ['"]?\{?(\w+)\}?['"]?/;
    // const mentionMatch = output.answer.match(variableMentionRegex);
    // if (mentionMatch) { ... }
    // const needsValue = variableNotFoundPatterns.some(pattern => pattern.test(output.answer));
    // if (needsValue) { ... }

    // Directly return the AI's output
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
