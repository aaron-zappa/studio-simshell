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
  variableName: z.string().describe('The exact name of the variable whose value needs to be retrieved.'),
});

// Define output schema for the tool
const GetVariableOutputSchema = z.object({
  value: z.string().nullable().describe('The stored value of the variable as a string. Returns null if the variable name is not found in the system storage.'),
});

// Define the Genkit tool
export const getVariableValue = ai.defineTool(
  {
    name: 'getVariableValue',
    description: 'Retrieves the current value of a specified variable that is stored in the system. Use this tool only when you need the value of a variable mentioned in the user\'s query (often indicated by `{varname}` or `<variable \'varname\' not found>`) but the value was not provided in the initial input text.',
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
