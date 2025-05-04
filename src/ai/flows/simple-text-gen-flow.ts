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
import { getVariableValue } from '@/ai/tools/get-variable-tool'; // Import the tool

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
  // Provide the tool to the prompt
  tools: [getVariableValue],
  // Update prompt instructions
  prompt: `Carefully analyze the following user input and generate a helpful response.

Sometimes, the input text might refer to variables using curly braces like {varname}. The system tries to substitute these with their stored values beforehand.

**IMPORTANT:** If you encounter a placeholder like "<variable 'some_variable_name' not found>" in the input, OR if the user's query implicitly requires the value of a variable {varname} that wasn't substituted, you MUST use the 'getVariableValue' tool to retrieve the current value for 'some_variable_name' before formulating your final answer. Only use the tool if obtaining the variable's value is necessary to properly address the user's request. If the tool returns null for the variable, state that the value could not be determined. Do not ask the user to provide the value again if the tool failed.

Respond directly and concisely based on the potentially updated information.

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

    // Check if the AI output indicates it couldn't find the variable, even after tool use attempt
    const variableNotFoundPatterns = [
        /i need the value of variable/i,
        /please provide the value/i,
        /attempt to retrieve it/i,
        /cannot determine the value of/i, // Added based on user feedback example
        /value for ['"]?\{?(\w+)\}?['"]? could not be determined/i, // More specific pattern
    ];

    let variableName: string | null = null;
    const variableMentionRegex = /variable ['"]?\{?(\w+)\}?['"]?/;
    const mentionMatch = output.answer.match(variableMentionRegex);
    if (mentionMatch) {
        variableName = mentionMatch[1];
    }

    const needsValue = variableNotFoundPatterns.some(pattern => pattern.test(output.answer));

    if (needsValue) {
        // Modify the output to be more definitive about the failure
        console.warn(`AI indicated variable value needed but wasn't found/retrieved. Original Answer: "${output.answer}"`);
        const varNameText = variableName ? `'${variableName}' ` : '';
        output.answer = `AI could not determine the value for variable ${varNameText}needed to fulfill the request.`;
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
