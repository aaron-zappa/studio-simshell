// src/ai/tools/get-variable-tool.ts
'use server';
/**
 * @fileOverview A Genkit tool to retrieve the value of a variable stored in the database.
 *
 * - getVariableValue - The Genkit tool instance.
 */

import { ai } from '@/ai/ai-instance';
import { getVariableFromDb } from '@/lib/variables';
import { z } from 'genkit';

// Define input schema for the tool
const GetVariableInputSchema = z.object({
  variableName: z.string().describe('The name of the variable to retrieve the value for.'),
});

// Define output schema for the tool
const GetVariableOutputSchema = z.object({
  value: z.string().nullable().describe('The value of the variable as a string, or null if the variable is not found.'),
});

// Define the Genkit tool
export const getVariableValue = ai.defineTool(
  {
    name: 'getVariableValue',
    description: 'Retrieves the current value of a specified variable stored in the system. Use this if you need the value of a variable mentioned in the user query that was not provided directly.',
    inputSchema: GetVariableInputSchema,
    outputSchema: GetVariableOutputSchema,
  },
  async (input) => {
    try {
      const variable = await getVariableFromDb(input.variableName);
      return {
        value: variable ? variable.value : null, // Return the value as string or null
      };
    } catch (error) {
      console.error(`Tool Error: Failed to get variable '${input.variableName}':`, error);
      // Return null in case of error to avoid breaking the flow
      return { value: null };
    }
  }
);

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'get-variable-tool.ts';
}
