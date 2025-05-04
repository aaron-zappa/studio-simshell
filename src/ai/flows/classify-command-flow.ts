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
  // Basic pre-validation: Ensure at least one category is active
  if (!input.activeCategories || input.activeCategories.length === 0) {
     console.warn("classifyCommand called with no active categories. Defaulting to 'unknown'.");
     return { category: 'unknown', reasoning: 'No command categories were active.' };
  }
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
  // Updated Prompt: Stronger emphasis on active categories only and assignment rule.
  // Fixed backtick issue in 'internal' definition.
  // Added 'list py vars' and 'export db' to internal definition.
  prompt: `You are an expert command line interpreter. Your task is to classify the given command STRICTLY based *only* on the following **active** command categories: {{#each activeCategories}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}.

Analyze the command based on its syntax, keywords, and typical usage patterns ONLY as they relate to these **ACTIVE** categories. Ignore any resemblance to patterns from categories that are NOT listed as active.

**Classification Rules (CRITICAL - Follow these exactly):**

1.  **Internal Override (if active):** If 'internal' is one of the **active** categories AND the command is a known SimuShell internal command (like 'help', 'clear', 'add_int_cmd', 'list py vars', 'export db', etc., or a custom defined one), *always* classify it as 'internal', even if it might resemble another category.
2.  **Internal Variable Assignment (if active):** If 'internal' is one of the **active** categories AND the command is a variable assignment in the format \`variable_name = value\` (e.g., 'x = 10', 'my_string = "hello"', 'is_active = True'), *always* classify it as 'internal'. This takes precedence over potential Python classification if 'internal' is active.
3.  **Single Match (within active):** If the command *clearly* and *unambiguously* matches the patterns of exactly ONE **active** category (and isn't covered by rules 1 or 2), classify it as that category (e.g., if only 'sql' is active and the command is \`SELECT * FROM users\`, classify as 'sql').
4.  **Ambiguous Match (between active):** If the command could *reasonably* match the patterns of **TWO OR MORE** **ACTIVE** categories (and isn't covered by rules 1 or 2), classify it as 'ambiguous'. Provide reasoning explaining which **active** categories it conflicts between (e.g., if 'unix' AND 'windows' are *both active* and the command is \`echo hello\`, classify as 'ambiguous', reason: "Matches both active Unix and Windows echo").
5.  **Unknown Match (no match in active):** If the command does *not clearly* match the patterns of **ANY** of the **ACTIVE** categories (and isn't covered by rules 1 or 2), classify it as 'unknown'. Provide brief reasoning why it doesn't fit the active categories. Crucially, if the command resembles a category that is NOT currently active, it MUST be classified as 'unknown' relative to the active set (e.g., if only 'sql' is active and the command is \`ls\`, classify as 'unknown', reason: "'ls' is not a SQL command.").


**Active Categories to Consider (ONLY THESE):**
{{#each activeCategories}}
- \`{{{this}}}\`
{{/each}}

**General Category Definitions (for context only, do NOT use inactive categories for classification):**
- internal: SimuShell specific commands like 'help', 'clear', 'mode', 'history', 'define', 'refine', 'add_int_cmd', 'export log', 'export db', 'pause', 'create sqlite', 'init', 'init db', 'list py vars', 'show requirements', 'persist memory db to', 'ai', any custom defined internal commands, AND variable assignments (e.g., 'x = 5', 'name = "test"').
- python: Python code snippets or commands (e.g., 'print("hello")', 'import os', 'def my_func():'). *Excludes* simple variable assignments if 'internal' mode is active.
- unix: Common Unix/Linux shell commands (e.g., 'ls -la', 'cd /home', 'grep "pattern" file.txt', 'echo $PATH').
- windows: Common Windows Command Prompt or PowerShell commands (e.g., 'dir C:\\', 'cd %USERPROFILE%', 'echo %VAR%', 'Copy-Item'). Note that 'echo' and 'cd' can also be Unix.
- sql: SQL queries (e.g., 'SELECT * FROM users WHERE id = 1;', 'INSERT INTO products (...) VALUES (...)', 'CREATE TABLE ...', 'SELECT 1;').
- excel: Excel-like formulas (e.g., 'SUM(A1:B5)', 'VLOOKUP(...)').

**User Command:**
\`\`\`
{{{command}}}
\`\`\`

**Output:** Classify the command into ONE of the active categories ({{#each activeCategories}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}), 'ambiguous' (only if conflicting between ACTIVE categories), or 'unknown' (if it doesn't match ANY active category). Follow the rules strictly. Provide reasoning if 'ambiguous' or 'unknown'.
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
            'add_int_cmd', 'export log', 'export db', 'pause', 'create sqlite',
            'init', 'init db', 'list py vars',
            'show requirements', 'persist memory db to', 'ai',
            'add ai_tool', 'set ai_tool' // Add base commands for multi-step ones
        ];
        // Check for simple variable assignment pattern as well
        const assignmentRegex = /^\s*([a-zA-Z_]\w*)\s*=\s*.+\s*$/;

        if (assignmentRegex.test(input.command.trim())) {
             return { category: 'internal' }; // Directly classify assignment as internal if active
        }


         // Need to handle multi-word command names and commands with arguments
         let matchedInternal = false;
         for (const intCmd of internalCommands) {
             // Check for exact match (handles single and multi-word commands like 'list py vars', 'export db')
             if (commandLower === intCmd) {
                 matchedInternal = true;
                 break;
             }
             // Check for commands requiring arguments that start with the base command + space
             // Handle specific multi-word commands needing args
             const commandsNeedingArgs = ['persist memory db to', 'create sqlite', 'add_int_cmd', 'add ai_tool', 'set ai_tool', 'ai'];
             if (commandsNeedingArgs.includes(intCmd) && commandLower.startsWith(intCmd + ' ')) {
                 matchedInternal = true;
                 break;
             }
             // Check for single-word commands that might take args
             if (!intCmd.includes(' ') && commandLower.startsWith(intCmd + ' ')) {
                  // Limit which single-word commands accept args
                 if (['help', 'mode', 'define', 'refine'].includes(intCmd)) {
                    matchedInternal = true;
                    break;
                 }
             }
         }


        if (matchedInternal) {
            return { category: 'internal' }; // Directly classify known command as internal if active and matched
        }
    }

    // If not a clear internal command or assignment (or internal wasn't active), proceed with AI classification
    // Pass the activeCategories to the prompt
    const { output } = await classifyPrompt(input); // Use classifyPrompt here

    // Basic validation or refinement can happen here if needed
    if (!output) {
        console.error("AI classification failed to return output for command:", input.command);
        return { category: 'unknown', reasoning: 'AI classification failed.' };
    }

    // Ensure 'ambiguous' or 'unknown' have reasoning if possible
    if ((output.category === 'ambiguous' || output.category === 'unknown') && !output.reasoning) {
       console.warn(`AI classified as ${output.category} but provided no reasoning. Command: ${input.command}, Active: ${input.activeCategories.join(', ')}`);
       // Provide a default reasoning based on the classification and active categories
       if (output.category === 'ambiguous') {
           output.reasoning = `Command matches patterns of multiple active categories: ${input.activeCategories.join(', ')}.`;
       } else { // unknown
            output.reasoning = `Command does not match patterns of any active categories: ${input.activeCategories.join(', ')}.`;
       }
    }


     // Ensure the returned category is valid or ambiguous/unknown
     const validOutputCategories = [...ALL_COMMAND_MODES, 'ambiguous', 'unknown'];
     if (!validOutputCategories.includes(output.category)) {
        console.warn(`AI returned an unexpected category: ${output.category}. Defaulting to 'unknown'. Command: ${input.command}`);
        return { category: 'unknown', reasoning: `AI returned unexpected category '${output.category}'. Command: ${input.command}` };
     }

     // **CRITICAL CHECK**: If AI returns a category that wasn't active, treat as unknown (unless it's ambiguous/unknown already)
     if (output.category !== 'ambiguous' && output.category !== 'unknown' && !input.activeCategories.includes(output.category as CommandMode)) {
        console.warn(`AI returned category '${output.category}' which was NOT in active list: ${input.activeCategories.join(', ')}. Treating as 'unknown'. Command: ${input.command}`);
        return {
            category: 'unknown',
            reasoning: `Command resembled '${output.category}', but this category was not active. Active categories: ${input.activeCategories.join(', ')}.`
        };
     }


    return output;
  }
);

// Export the flow directly
export { classifyCommandFlow };

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'classify-command-flow.ts';
}
