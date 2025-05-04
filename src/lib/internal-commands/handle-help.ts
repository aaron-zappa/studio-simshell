// src/lib/internal-commands/handle-help.ts
// src/lib/internal-commands/handle-help.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';
import type { LogEntry } from '@/lib/logging'; // Import LogEntry

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (not applicable here yet)
}


interface HandlerParams {
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    // Potentially add currentLogEntries if this command needs to log
}

// Update function signature to return HandlerResult
export const handleHelp = ({ timestamp, initialSuggestions }: HandlerParams): HandlerResult => {
    // Update help text to reflect new 'add_int_cmd' format and 'create sqlite'
    const helpText = `Command category is automatically detected.
Available categories: ${Object.keys(initialSuggestions).join(', ')}.
Available internal commands: help, clear, history, define, refine, add_int_cmd <short> <name> "<description>" <whatToDo>, export log, pause, create sqlite <filename.db>, show requirements
Run custom commands by typing their name.
Note: 'mode' command is informational only.`;
    const outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal' }];

    // Return the result object (no log changes in this handler)
    return { outputLines: outputLines };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-help.ts';
}
