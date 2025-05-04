// src/ai/flows/classify-command-flow.ts
// src/ai/flows/classify-command-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to classify user commands based on active categories.
 *
 * - classifyCommand - A function that classifies a command string considering active categories.
 * - ClassifyCommandInput - The input type for the classifyCommand function.
 * - ClassifyCommandOutput - The return type for the classifyCommand function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import type { CommandMode } from '@/types/command-types'; // Import CommandMode
import { ALL_COMMAND_MODES } from '@/types/command-types'; // Import ALL_COMMAND_MODES

// Define the possible categories, including ambiguous and unknown (for output)
const CommandCategorySchema = z.enum(['internal', 'python', 'unix', 'windows', 'sql', 'excel', 'ambiguous', 'unknown']);
export type CommandCategory = z.infer<typeof CommandCategorySchema>;

// Define a schema for the executable modes (for input)
const CommandModeSchema = z.enum(ALL_COMMAND_MODES);

const ClassifyCommandInputSchema = z.object({
  command: z.string().describe('The command string entered by the user.'),
  activeCategories: z.array(CommandModeSchema).describe('The command categories currently active/selected by the user.'),
});
export type ClassifyCommandInput = z.infer<typeof ClassifyCommandInputSchema>;

const ClassifyCommandOutputSchema = z.object({
  category: CommandCategorySchema.describe('The classified category of the command (or ambiguous/unknown).'),
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
    schema: ClassifyCommandInputSchema, // Use updated input schema
  },
  output: {
    schema: ClassifyCommandOutputSchema,
  },
  prompt: `You are an expert command line interpreter. Your task is to classify the given command based *only* on the following active command categories provided by the user: {{#each activeCategories}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}.

Analyze the command based on its syntax, keywords, and typical usage patterns relevant *only* to these active categories: {{#each activeCategories}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}.

**Classification Rules (Strictly adhere to these):**

1.  **Single Match:** If the command *clearly* and *unambiguously* matches the patterns of exactly ONE active category, classify it as that category (e.g., if only 'sql' is active and the command is \`SELECT * FROM users\`, classify as 'sql').
2.  **Ambiguous Match:** If the command could *reasonably* match the patterns of **TWO OR MORE** active categories, classify it as 'ambiguous'. Provide reasoning explaining which active categories it conflicts between (e.g., if 'unix' and 'windows' are active and the command is \`echo hello\`, classify as 'ambiguous', reason: "Matches both Unix and Windows echo").
3.  **Unknown Match:** If the command does *not clearly* match the patterns of **ANY** of the active categories, classify it as 'unknown'. Provide brief reasoning why it doesn't fit the active categories.
4.  **Internal Override:** If the command is a known SimuShell internal command (like 'help', 'clear', 'add_int_cmd', etc.) AND 'internal' is one of the active categories, *always* classify it as 'internal', even if it might resemble another category.

**Active Categories to Consider:**
{{#each activeCategories}}
- \`{{{this}}}\`
{{/each}}

**General Category Definitions (for context, but only classify within ACTIVE ones):**
- internal: SimuShell specific commands like 'help', 'clear', 'mode', 'history', 'define', 'refine', 'add_int_cmd', 'export log', 'pause', 'create sqlite', 'show requirements', 'persist memory db to', and any custom defined internal commands.
- python: Python code snippets or commands (e.g., 'print("hello")', 'import os', 'def my_func():').
- unix: Common Unix/Linux shell commands (e.g., 'ls -la', 'cd /home', 'grep "pattern" file.txt', 'echo $PATH').
- windows: Common Windows Command Prompt or PowerShell commands (e.g., 'dir C:\\', 'cd %USERPROFILE%', 'echo %VAR%', 'Copy-Item'). Note that 'echo' and 'cd' can also be Unix.
- sql: SQL queries (e.g., 'SELECT * FROM users WHERE id = 1;', 'INSERT INTO products (...) VALUES (...)', 'CREATE TABLE ...', 'SELECT 1;').
- excel: Excel-like formulas (e.g., 'SUM(A1:B5)', 'VLOOKUP(...)').

**User Command:**
\`\`\`
{{{command}}}
\`\`\`

**Output:** Classify the command into one of the active categories ({{#each activeCategories}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}), 'ambiguous', or 'unknown' based *only* on the rules above. Provide reasoning if 'ambiguous' or 'unknown'.
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
    // ONLY if 'internal' is an active category
    if (input.activeCategories.includes('internal')) {
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
            return { category: 'internal' }; // Directly classify as internal if active and matched
        }
    }

    // If not a clear internal command (or internal wasn't active), proceed with AI classification
    // Pass the activeCategories to the prompt
    const {output} = await classifyPrompt(input);

    // Basic validation or refinement can happen here if needed
    if (!output) {
        return { category: 'unknown', reasoning: 'AI classification failed.' };
    }

    // Ensure 'ambiguous' or 'unknown' have reasoning if possible
    if ((output.category === 'ambiguous' || output.category === 'unknown') && !output.reasoning) {
       output.reasoning = `AI classified as ${output.category} but provided no reasoning. Command did not fit active categories: ${input.activeCategories.join(', ')}.`;
    }

     // Ensure the returned category is valid or ambiguous/unknown
     const isValidOutputCategory = ALL_COMMAND_MODES.includes(output.category as CommandMode) || output.category === 'ambiguous' || output.category === 'unknown';
     if (!isValidOutputCategory) {
        console.warn(`AI returned an unexpected category: ${output.category}. Defaulting to 'unknown'.`);
        return { category: 'unknown', reasoning: `AI returned unexpected category '${output.category}'. Command: ${input.command}` };
     }

     // Additional check: If AI returns a category that wasn't active, treat as unknown (unless it's ambiguous/unknown already)
     if (output.category !== 'ambiguous' && output.category !== 'unknown' && !input.activeCategories.includes(output.category as CommandMode)) {
        console.warn(`AI returned category '${output.category}' which was not in active list: ${input.activeCategories.join(', ')}. Treating as 'unknown'.`);
        return { category: 'unknown', reasoning: `Command classified as '${output.category}', but this category was not active.` };
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
