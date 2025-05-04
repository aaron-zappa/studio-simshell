// src/lib/internal-commands/handle-mode.ts
// src/lib/internal-commands/handle-mode.ts
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
    args: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    // Potentially add currentLogEntries if this command needs to log
}

// Mode switching is now handled by AI classification before executeCommand is called.
// This handler becomes informational or could be removed.
// Update function signature to return HandlerResult and make it async
export const handleMode = async ({ args, timestamp, initialSuggestions }: HandlerParams): Promise<HandlerResult> => {
    const requestedMode = args[0] as CommandMode;
    let outputLines: OutputLine[];

    if (args.length === 0) {
       outputLines = [{ id: `mode-info-${timestamp}`, text: `Command category is automatically detected. Available categories: ${Object.keys(initialSuggestions).join(', ')}. Use 'help' for more info.`, type: 'info', category: 'internal' }];
    }
    // Check if the requested mode is valid just for info purposes
    else if (Object.keys(initialSuggestions).includes(requestedMode)) {
        outputLines = [{ id: `mode-info-${timestamp}`, text: `Info: You requested mode '${requestedMode}'. Command category is automatically detected.`, type: 'info', category: 'internal' }];
    } else {
        outputLines = [{ id: `mode-error-${timestamp}`, text: `Info: '${requestedMode}' is not a recognized category. Categories are automatically detected. Valid categories: ${Object.keys(initialSuggestions).join(', ')}`, type: 'error', category: 'internal' }];
    }

    // Return the result object (no log changes in this handler)
    return { outputLines: outputLines };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-mode.ts';
}

