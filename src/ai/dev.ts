// src/ai/dev.ts
// src/ai/dev.ts
import type {Flow, Tool} from 'genkit';

// Import flows explicitly
import { classifyCommandFlow } from './flows/classify-command-flow';
import { simpleTextGenFlow } from './flows/simple-text-gen-flow';

// Import tools explicitly
// Removed: import { getVariableValue } from './tools/get-variable-tool'; // Remove tool import

// Create the flows array by exporting the imported flow objects
export const flows: Flow<any, any, any>[] = [
  classifyCommandFlow,
  simpleTextGenFlow,
  // Add other imported flows here
  // e.g., anotherFlow,
];

// Create the tools array (optional for dev UI, but useful)
// Remove the tool from the exported array
export const tools: Tool<any, any>[] = [
    // Removed: getVariableValue,
    // Add other imported tools here
];


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'dev.ts';
}
