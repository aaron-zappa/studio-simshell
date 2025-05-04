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
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    args: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Mode switching is now handled by AI classification before executeCommand is called.
// This handler becomes informational or could be removed.
// Update function signature to return HandlerResult and make it async
export const handleMode = async ({ args, timestamp, initialSuggestions, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    // No specific permission needed for this info command
    const requestedMode = args[0] as CommandMode;
    let outputLines: OutputLine[];
    let logText: string;
    let logType: 'I' | 'W' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let logFlag: 0 | 1 = 0; // Default flag

    if (args.length === 0) {
       logText = `Command category is automatically detected. Available categories: ${Object.keys(initialSuggestions).join(', ')}. Use 'help' for more info.`;
       outputType = 'info';
       outputLines = [{ id: `mode-info-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp }];
    }
    // Check if the requested mode is valid just for info purposes
    else if (Object.keys(initialSuggestions).includes(requestedMode)) {
        logText = `Info: You requested mode '${requestedMode}'. Command category is automatically detected.`;
        outputType = 'info';
        outputLines = [{ id: `mode-info-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp }];
    } else {
        logText = `Info: '${requestedMode}' is not a recognized category. Categories are automatically detected. Valid categories: ${Object.keys(initialSuggestions).join(', ')}`;
        logType = 'W'; // Warning for invalid request
        logFlag = 1; // Set flag for warning
        outputType = 'error'; // Keep output as error for user feedback
        outputLines = [{ id: `mode-error-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp }];
    }

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText + ` (User: ${userId})` };
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