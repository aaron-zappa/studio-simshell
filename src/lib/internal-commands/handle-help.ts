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

// Update function signature to return Promise<HandlerResult> and make it async
export const handleHelp = async ({ timestamp, initialSuggestions, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    // No specific permission needed for help
    // Correct the help text for add ai_tool to <toolname> "<args_description>" "<description>"
    // Add the new 'set ai_tool active' command
    const helpText = `Command category is automatically detected. \n @bat:<filename><.bat/.sh/.sim>(experimental).
Available categories: ${Object.keys(initialSuggestions).join(', ')}.
Available internal commands: help, clear, history, define, refine, add int_cmd <short> <name> "<description>" <whatToDo>, add ai_tool <toolname> "<args_description>" "<description>", set ai_tool <name> active <0|1>, export log, export db, pause, create sqlite <filename.db>, init, init db, list py vars, show requirements, persist memory db to <filename.db>, ai <inputtext> (use {varname} for variable substitution)
Run custom commands by typing their name.
Note: 'mode' command is informational only.`;
    const outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined }]; // Remove timestamp for non-log output

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: 'I', text: `Displayed help. (User: ${userId})` };
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
