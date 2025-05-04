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
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Update function signature to return HandlerResult and make it async
export const handleHelp = async ({ timestamp, initialSuggestions, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    // Update help text to include 'init' command
    const helpText = `Command category is automatically detected.
Available categories: ${Object.keys(initialSuggestions).join(', ')}.
Available internal commands: help, clear, history, define, refine, add_int_cmd <short> <name> "<description>" <whatToDo>, export log, pause, create sqlite <filename.db>, init, init db, show requirements, persist memory db to <filename.db>
Run custom commands by typing their name.
Note: 'mode' command is informational only.`;
    const outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp }];

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: 'I', text: `Displayed help.` };
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
