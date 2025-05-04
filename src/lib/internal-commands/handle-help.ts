// src/lib/internal-commands/handle-help.ts
// src/lib/internal-commands/handle-help.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses new LogEntry type
}


interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[]; // Pass current logs
}

/**
 * Handles the 'help' command.
 * Displays available categories, internal commands, and usage notes, grouped by category.
 */
// Update function signature to return Promise<HandlerResult> and make it async
export const handleHelp = async ({ timestamp, initialSuggestions, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    // No specific permission needed for help

    let helpText = `Command category is automatically detected based on input and active categories.
@bat:<filename><.bat/.sh/.sim>(experimental).

Available categories: ${Object.keys(initialSuggestions).join(', ')}.

--- Command Suggestions by Category ---`;

    // Iterate through categories and their suggestions
    for (const category in initialSuggestions) {
        const suggestions = initialSuggestions[category as CommandMode];
        if (suggestions && suggestions.length > 0) {
            // Add bold category heading
            helpText += `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
            // List suggestions under the category
            suggestions.forEach(suggestion => {
                helpText += `\n- ${suggestion}`;
            });
        }
    }

    helpText += `\n\nRun custom commands by typing their name.
Assign variables using \`var_name = value\`.
Note: 'mode' command is informational only.`;


    const outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined, flag: 0 }]; // Add flag

    // Create log entry with flag=0
    const logEntry: LogEntry = { timestamp, type: 'I', flag: 0, text: `Displayed help. (User: ${userId})` };
    const newLogEntries = [...currentLogEntries, logEntry];

    // Return the result object
    return { outputLines: outputLines, newLogEntries };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-help.ts';
}
