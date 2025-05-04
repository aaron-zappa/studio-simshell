// src/ai/flows/classify-command-flow.ts
// src/ai/flows/classify-command-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to classify user commands.
 *
 * - classifyCommand - A function that classifies a command string.
 * - ClassifyCommandInput - The input type for the classifyCommand function.
 * - ClassifyCommandOutput - The return type for the classifyCommand function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import type { CommandMode } from '@/types/command-types'; // Import CommandMode

// Define the possible categories, including ambiguous and unknown
const CommandCategorySchema = z.enum(['internal', 'python', 'unix', 'windows', 'sql', 'excel', 'ambiguous', 'unknown']);
export type CommandCategory = z.infer<typeof CommandCategorySchema>;

const ClassifyCommandInputSchema = z.object({
  command: z.string().describe('The command string entered by the user.'),
  // Optionally, add known custom commands if they influence classification significantly
  // customInternalCommands: z.array(z.string()).optional().describe('List of known custom internal commands.'),
});
export type ClassifyCommandInput = z.infer<typeof ClassifyCommandInputSchema>;

const ClassifyCommandOutputSchema = z.object({
  category: CommandCategorySchema.describe('The classified category of the command.'),
  reasoning: z.string().optional().describe('Brief reasoning for the classification, especially if ambiguous or unknown.'),
});
export type ClassifyCommandOutput = z.infer<typeof ClassifyCommandOutputSchema>;


// Exported wrapper function
export async function classifyCommand(input: ClassifyCommandInput): Promise<ClassifyCommandOutput> {
  return classifyCommandFlow(input);
}

const classifyPrompt = ai.definePrompt({
  name: 'classifyCommandPrompt',
  input: {
    schema: ClassifyCommandInputSchema,
  },
  output: {
    schema: ClassifyCommandOutputSchema,
  },
  prompt: `You are an expert command line interpreter. Your task is to classify the given command into one of the following categories: 'internal', 'python', 'unix', 'windows', 'sql', 'excel'.

Consider the command syntax, keywords, and typical usage.

Categories:
- internal: SimuShell specific commands like 'help', 'clear', 'mode', 'history', 'define', 'refine', 'add_int_cmd', 'export log', 'pause', 'create sqlite', 'show requirements', 'persist memory db to', and any custom defined internal commands.
- python: Python code snippets or commands (e.g., 'print("hello")', 'import os', 'def my_func():').
- unix: Common Unix/Linux shell commands (e.g., 'ls -la', 'cd /home', 'grep "pattern" file.txt', 'echo $PATH').
- windows: Common Windows Command Prompt or PowerShell commands (e.g., 'dir C:\\', 'cd %USERPROFILE%', 'echo %VAR%', 'Copy-Item'). Note that 'echo' and 'cd' can also be Unix.
- sql: SQL queries (e.g., 'SELECT * FROM users WHERE id = 1;', 'INSERT INTO products (...) VALUES (...)', 'CREATE TABLE ...', 'SELECT 1;').
- excel: Excel-like formulas (e.g., 'SUM(A1:B5)', 'VLOOKUP(...)').

If the command could belong to multiple categories (e.g., 'echo hello' could be unix or windows), classify it as 'ambiguous'.
If the command does not clearly fit into any category or looks like random text, classify it as 'unknown'.

User Command:
\`\`\`
{{{command}}}
\`\`\`

Classify the command and provide brief reasoning if it's ambiguous or unknown.
`,
});

const classifyCommandFlow = ai.defineFlow<
  typeof ClassifyCommandInputSchema,
  typeof ClassifyCommandOutputSchema
>(
  {
    name: 'classifyCommandFlow',
    inputSchema: ClassifyCommandInputSchema,
    outputSchema: ClassifyCommandOutputSchema,
  },
  async (input) => {
    // Add simple pre-checks for common internal commands to potentially bypass AI call
    const commandLower = input.command.toLowerCase().trim();
    const internalCommands = [
        'help', 'clear', 'mode', 'history', 'define', 'refine',
        'add_int_cmd', 'export log', 'pause', 'create sqlite', 'show requirements',
        'persist memory db to' // Added new command prefix
    ];
    const commandName = commandLower.split(' ')[0];
    const commandPrefix = commandLower.split(' ')[0] + (commandLower.includes(' ') ? ' ' : ''); // e.g. 'show ' or 'help'

    // Check if the command *exactly* matches or *starts with* a known internal command prefix
     if (internalCommands.some(intCmd => {
        const cmdPrefixToCheck = intCmd.includes(' ') ? intCmd.split(' ')[0] + ' ' : intCmd; // e.g., 'add_int_cmd ' or 'help'
        // Special check for commands requiring arguments
        if (intCmd === 'add_int_cmd' || intCmd === 'create sqlite' || intCmd === 'persist memory db to') {
            return commandPrefix === intCmd + ' '; // Must have space after command name
        }
        // For commands without arguments or variable arguments (like help)
        return commandLower === intCmd || commandPrefix === cmdPrefixToCheck;
    })) {
        return { category: 'internal' };
    }

    // If not a clear internal command, proceed with AI classification
    const {output} = await classifyPrompt(input);

    // Basic validation or refinement can happen here if needed
    if (!output) {
        return { category: 'unknown', reasoning: 'AI classification failed.' };
    }

    // Ensure 'ambiguous' or 'unknown' have reasoning if possible
    if ((output.category === 'ambiguous' || output.category === 'unknown') && !output.reasoning) {
       output.reasoning = `AI classified as ${output.category} but provided no reasoning.`;
    }


    return output;
  }
);

// Add the flow to the dev registry
import {flows} from '@/ai/dev';
flows.push(classifyCommandFlow);

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'classify-command-flow.ts';
}
