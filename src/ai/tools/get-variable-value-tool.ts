/src/ai/tools/get-variable-value-tool.ts
// src/ai/tools/get-variable-value-tool.ts
'use server';
/**
 * @fileOverview Genkit tool definition for retrieving variable values.
 */
import {ai} from '@/ai/ai-instance';
import { getVariableFromDb } from '@/lib/variables';
import {z} from 'genkit';

// Define the input schema for the tool
const GetVariableValueInputSchema = z.object({
  variableName: z.string().describe('The name of the variable whose value needs to be retrieved.'),
});

// Define the output schema for the tool
// Output is a string representation of the value, or null if not found.
const GetVariableValueOutputSchema = z.string().nullable().describe('The string value of the variable, or null if the variable is not found.');

export const getVariableValue = ai.defineTool(
  {
    name: 'getVariableValue',
    description: 'Retrieves the current value of a specified variable stored in the system. Use this tool only when you need the value of a variable mentioned in the user\'s query (often indicated by {varname} or <variable \'varname\' not found>) but the value was not provided in the initial input text.',
    inputSchema: GetVariableValueInputSchema,
    outputSchema: GetVariableValueOutputSchema,
  },
  async (input) => {
    try {
      const variableDetails = await getVariableFromDb(input.variableName);
      if (variableDetails) {
        // Return the value as a string. Genkit/Zod handles serialization.
        // The schema defines the output as `string().nullable()`.
        return variableDetails.value;
      } else {
        // Variable not found, return null as per the schema.
        return null;
      }
    } catch (error) {
      console.error(`Tool Error: Failed to get variable '${input.variableName}' from DB:`, error);
      // You might return null or throw a specific error depending on how you want the AI to handle DB failures.
      // Returning null aligns with "not found".
      return null;
      // OR: throw new Error(`Database error retrieving variable '${input.variableName}'.`);
    }
  }
);
