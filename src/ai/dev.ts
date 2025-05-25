/src/ai/dev.ts
// src/ai/dev.ts
import type {Flow, Tool} from 'genkit';

// Import flows explicitly
import { classifyCommandFlow } from './flows/classify-command-flow';
import { simpleTextGenFlow } from './flows/simple-text-gen-flow';
import { listAllTablesQuery } from './flows/list-all-tables-flow'; // Corrected import

// Import tools explicitly
import { getVariableValue } from './tools/get-variable-value-tool'; // Import the tool

// Create the flows array by exporting the imported flow objects
export const flows: Flow<any, any, any>[] = [
  classifyCommandFlow,
  simpleTextGenFlow,
  listAllTablesQuery, // Corrected to use the exported function name
  // Add other imported flows here
  // e.g., anotherFlow,
];

// Create the tools array (optional for dev UI, but useful)
// Include the getVariableValue tool
export const tools: Tool<any, any>[] = [
    getVariableValue,
    // Add other imported tools here
];
