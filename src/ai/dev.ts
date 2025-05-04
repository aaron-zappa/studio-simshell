// src/ai/dev.ts
// src/ai/dev.ts
import type {Flow} from 'genkit';

// Import flows explicitly
import { classifyCommandFlow } from './flows/classify-command-flow';
import { simpleTextGenFlow } from './flows/simple-text-gen-flow';

// Create the flows array by exporting the imported flow objects
export const flows: Flow<any, any, any>[] = [
  classifyCommandFlow,
  simpleTextGenFlow,
  // Add other imported flows here
  // e.g., anotherFlow,
];

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
export function getFilename(): string {
    return 'dev.ts';
}
