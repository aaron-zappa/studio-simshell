// src/lib/internal-commands/handle-mode.ts
// src/lib/internal-commands/handle-mode.ts
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
    args: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Mode switching is now handled by AI classification before executeCommand is called.
// This handler becomes informational or could be removed.
// Update function signature to return HandlerResult and make it async
export const handleMode = async ({ args, timestamp, initialSuggestions, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const requestedMode = args[0] as CommandMode;
    let outputLines: OutputLine[];
    let logText: string;
    let logType: 'I' | 'W' = 'I';

    if (args.length === 0) {
       logText = `Command category is automatically detected. Available categories: ${Object.keys(initialSuggestions).join(', ')}. Use 'help' for more info.`;
       outputLines = [{ id: `mode-info-${timestamp}`, text: logText, type: 'info', category: 'internal' }];
    }
    // Check if the requested mode is valid just for info purposes
    else if (Object.keys(initialSuggestions).includes(requestedMode)) {
        logText = `Info: You requested mode '${requestedMode}'. Command category is automatically detected.`;
        outputLines = [{ id: `mode-info-${timestamp}`, text: logText, type: 'info', category: 'internal' }];
    } else {
        logText = `Info: '${requestedMode}' is not a recognized category. Categories are automatically detected. Valid categories: ${Object.keys(initialSuggestions).join(', ')}`;
        logType = 'W'; // Warning for invalid request
        outputLines = [{ id: `mode-error-${timestamp}`, text: logText, type: 'error', category: 'internal' }]; // Keep output as error for user feedback
    }

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
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
    return 'handle-mode.ts';
}
