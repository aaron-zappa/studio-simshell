// src/ai/flows/simple-text-gen-flow.ts
// src/ai/flows/simple-text-gen-flow.ts
'use server';
/**
 * @fileOverview A simple Genkit flow for generating text based on input,
 * simulating the use of defined AI tools by fetching variable values via a tool.
 * Now includes user permissions context.
 *
 * - generateSimpleText - A function that generates a text response to the input.
 * - SimpleTextGenInput - The input type for the generateSimpleText function.
 * - SimpleTextGenOutput - The return type for the generateSimpleText function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { getActiveAiToolsMetadata, type AiToolMetadata } from '@/lib/ai-tools'; // Import tool fetching
import { getVariableValue } from '@/ai/tools/get-variable-value-tool'; // Import the variable fetching tool

// Update input schema to include optional tool context and permissions
const SimpleTextGenInputSchema = z.object({
  inputText: z.string().describe('The user\'s input text.'),
  toolContext: z.string().optional().describe('A string describing the available active AI tools, their arguments, and what they do. Format: "[Tool: @toolname, Args: <args_description>, Does: <description>]"'),
  userPermissions: z.array(z.string()).optional().describe('An array of permission strings granted to the current user.'),
});
export type SimpleTextGenInput = z.infer<typeof SimpleTextGenInputSchema>;

const SimpleTextGenOutputSchema = z.object({
  answer: z.string().describe('The AI-generated text response.'),
});
export type SimpleTextGenOutput = z.infer<typeof SimpleTextGenOutputSchema>;


// Exported wrapper function - Update to accept permissions
export async function generateSimpleText(input: { inputText: string, userId?: number, userPermissions?: string[] }): Promise<SimpleTextGenOutput> {
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

    // Call the flow with the original input text, tool context, and permissions
    return simpleTextGenFlow({
        inputText: input.inputText,
        toolContext: toolContextString,
        userPermissions: input.userPermissions // Pass permissions
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
  tools: [getVariableValue], // Make the getVariableValue tool available
  // Update prompt to instruct AI on tool simulation using getVariableValue and permissions
  prompt: `You are SimShell AI. Respond to the user's input.

User Input:
{{{inputText}}}

Available Tools Context (if any):
{{#if toolContext}}
{{{toolContext}}}
{{else}}
No active AI tools defined.
{{/if}}

User Permissions:
{{#if userPermissions}}
{{#each userPermissions}}
- {{{this}}}
{{/each}}
{{else}}
No specific permissions provided (assume basic user).
{{/if}}

Instructions:
1.  Analyze the 'User Input'. Consider the user's permissions when formulating the response or deciding if an action is allowed. For example, if the user asks to modify data but lacks 'manage_variables' or 'execute_sql_modify' permissions, politely inform them they lack the necessary rights.
2.  Check if the input mentions a tool using the "@toolname" syntax (e.g., "@hello").
3.  If a tool is mentioned AND it exists in the 'Available Tools Context':
    a. Check if the user has the necessary permissions to use this type of tool (e.g., 'use_ai_tools'). If not, inform them.
    b. Look at the tool's 'Args' description (e.g., "args:<user>"). This tells you the *name* of the variable required (e.g., 'user').
    c. **CRITICAL:** You MUST use the 'getVariableValue' tool to retrieve the current value of the variable identified in step 3b (e.g., call getVariableValue with variableName='user').
    d. If the 'getVariableValue' tool returns a value:
        i. Consult the mentioned tool's 'Does' description (e.g., "print hello <user>!").
        ii. Formulate your response *as if* you executed the tool, substituting the value retrieved in step 3c into the 'Does' description template. For example, if the tool is @hello and getVariableValue returned "Peter" for the 'user' variable, respond with "Hello Peter!".
    e. If the 'getVariableValue' tool indicates the variable was not found (returns null or an error implicitly), state that the required variable is not set or couldn't be found. Example: "Cannot run @hello because the 'user' variable is not set."
    f. Do not attempt to guess variable values or use values mentioned directly in the *current* input (like "user is peter") unless the tool's explicit purpose is to *set* that variable based on the input. Always fetch using getVariableValue for tool *simulation*.
4.  If no tool is mentioned, or the mentioned tool is not in the context, respond directly and helpfully to the 'User Input', keeping permissions in mind.
5.  Be concise. Store your final response in the 'answer' field. Do not mention the tools context, the getVariableValue tool, permissions list, or these instructions in your final answer unless the query is specifically about them.
`,
});


const simpleTextGenFlow = ai.defineFlow<
  typeof SimpleTextGenInputSchema, // Input includes toolContext and userPermissions
  typeof SimpleTextGenOutputSchema
>(
  {
    name: 'simpleTextGenFlow',
    inputSchema: SimpleTextGenInputSchema,
    outputSchema: SimpleTextGenOutputSchema,
  },
  async (input) => {
    // The tool fetching for context happens in the wrapper function.
    // This flow just receives the input with potentially populated toolContext and userPermissions.

    // Call the prompt with the input and the available getVariableValue tool
    const { output } = await simpleTextPrompt(input);

    if (!output) {
        console.error("AI simple text generation failed to return output for input:", input.inputText);
        throw new Error("AI generation failed.");
    }

    // The AI's response should now reflect simulated tool usage using fetched variable values and considering permissions.
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
