// src/ai/dev.ts
import type {Flow} from 'genkit';

// Array to hold flows for registration in ai-instance or elsewhere
export const flows: Flow<any, any, any>[] = [];

// Dynamically import flow files to ensure they are registered
// The import itself triggers the `ai.defineFlow` and adds to the `flows` array.
import './flows/classify-command-flow';

// Add imports for other flows here as they are created
// e.g., import './flows/another-flow';
