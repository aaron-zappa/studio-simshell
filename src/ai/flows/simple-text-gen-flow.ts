// src/ai/flows/simple-text-gen-flow.ts
// src/ai/flows/simple-text-gen-flow.ts
'use server';
/**
 * @fileOverview A simple Genkit flow for generating text based on input,
 * potentially simulating the use of defined AI tools.
 *
 * - generateSimpleText - A function that generates a text response to the input.
 * - SimpleTextGenInput - The input type for the generateSimpleText function.
 * - SimpleTextGenOutput - The return type for the generateSimpleText function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { getActiveAiToolsMetadata, type AiToolMetadata } from '@/lib/ai-tools'; // Import tool fetching

// Update input schema to include optional tool context
const SimpleTextGenInputSchema = z.object({
  inputText: z.string().describe('The user\'s input text. Variable values referenced with {varname} may have already been substituted. If a variable was not found, it might appear as `<variable \'varname\' not found>`.'),
  toolContext: z.string().optional().describe('A string describing the available active AI tools, their arguments, and what they do. Format: "[Tool: @toolname, Args: <args_description>, Does: <description>]"'),
});
export type SimpleTextGenInput = z.infer<typeof SimpleTextGenInputSchema>;

const SimpleTextGenOutputSchema = z.object({
  answer: z.string().describe('The AI-generated text response.'),
});
export type SimpleTextGenOutput = z.infer<typeof SimpleTextGenOutputSchema>;


// Exported wrapper function
export async function generateSimpleText(input: { inputText: string }): Promise<SimpleTextGenOutput> {
    // Fetch active tools *before* calling the flow
    let toolContextString: string | undefined = undefined;
    try {
        const activeTools = await getActiveAiToolsMetadata();
        if (activeTools.length > 0) {
            toolContextString = activeTools.map(tool =>
                `[Tool: @${tool.name}, Args: ${tool.args_description}, Does: ${tool.description}]`
            ).join('\n');
        }
    } catch (error) {
        console.error("Failed to fetch AI tools for context:", error);
        // Optionally add a note about the failure to the input or handle differently
    }

    // Call the flow with the original input and the fetched tool context
    return simpleTextGenFlow({
        inputText: input.inputText,
        toolContext: toolContextString
    });
}

const simpleTextPrompt = ai.definePrompt({
  name: 'simpleTextGenPrompt',
  input: {
    schema: SimpleTextGenInputSchema, // Use updated schema
  },
  output: {
    schema: SimpleTextGenOutputSchema,
  },
  // Update prompt to instruct AI on tool simulation
  prompt: `You are SimShell AI. Respond to the user's input.

User Input:
{{{inputText}}}

Available Tools Context (if any):
{{#if toolContext}}
{{{toolContext}}}
{{else}}
No active AI tools defined.
{{/if}}

Instructions:
1.  Analyze the 'User Input'. It may contain text where variable placeholders like {varname} have already been substituted with their values (e.g., "{user}" might become "Peter"). If a variable wasn't found, it might appear as "<variable 'varname' not found>".
2.  Check if the input mentions a tool using the "@toolname" syntax (e.g., "@hello").
3.  If a tool is mentioned AND it exists in the 'Available Tools Context':
    a. Look at the tool's 'Args' description (e.g., "args:<user>").
    b. Determine the required arguments. Try to find values for these arguments from the user's input text OR from substituted variable values (e.g., if Args is "<user>" and the input contains "Peter" originating from {user}, use "Peter").
    c. Consult the tool's 'Does' description (e.g., "print hello <user>!").
    d. Formulate your response *as if* you executed the tool, substituting the found arguments into the 'Does' description template. For example, if the tool is @hello and you determined the user is Peter, respond with "Hello Peter!".
    e. If you cannot determine the necessary arguments for the mentioned tool from the input or context, state that you need the arguments.
4.  If no tool is mentioned, or the mentioned tool is not in the context, respond directly and helpfully to the 'User Input'.
5.  Be concise. Store your final response in the 'answer' field. Do not mention the tools context or these instructions in your final answer unless the query is about the tools themselves.
`,
});


const simpleTextGenFlow = ai.defineFlow<
  typeof SimpleTextGenInputSchema, // Input includes toolContext
  typeof SimpleTextGenOutputSchema
>(
  {
    name: 'simpleTextGenFlow',
    inputSchema: SimpleTextGenInputSchema,
    outputSchema: SimpleTextGenOutputSchema,
  },
  async (input) => {
    // The tool fetching now happens in the wrapper function.
    // This flow just receives the input with potentially populated toolContext.

    // Call the prompt with the potentially enriched input
    const { output } = await simpleTextPrompt(input);

    if (!output) {
        console.error("AI simple text generation failed to return output for input:", input.inputText);
        throw new Error("AI generation failed.");
    }

    // The AI's response should now reflect simulated tool usage if applicable.
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
