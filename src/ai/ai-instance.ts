// src/ai/ai-instance.ts
// src/ai/ai-instance.ts
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
export function getFilename(): string {
    return 'ai-instance.ts';
}
