// src/ai/dev.ts
// src/ai/dev.ts
import type {Flow, Tool} from 'genkit';

// Import flows explicitly
import { classifyCommandFlow } from './flows/classify-command-flow';
import { simpleTextGenFlow } from './flows/simple-text-gen-flow';
import { listAllTablesFlow } from './flows/list-all-tables-flow'; // Import the new flow

// Import tools explicitly
import { getVariableValue } from './tools/get-variable-value-tool'; // Import the tool

// Create the flows array by exporting the imported flow objects
export const flows: Flow<any, any, any>[] = [
  classifyCommandFlow,
  simpleTextGenFlow,
  listAllTablesFlow, // Add the new flow here
  // Add other imported flows here
  // e.g., anotherFlow,
];

// Create the tools array (optional for dev UI, but useful)
// Include the getVariableValue tool
export const tools: Tool<any, any>[] = [
    getVariableValue,
    // Add other imported tools here
];
