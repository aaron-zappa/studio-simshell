// src/lib/internal-commands/handle-not-found.ts
// src/lib/internal-commands/handle-not-found.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses new LogEntry type
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    commandName: string;
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Update function signature to return HandlerResult and make it async
export const handleNotFound = async ({ commandName, timestamp, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    // No permission check needed for error message
    const outputText = `Internal command not found: ${commandName}`;
    const outputLines = [{ id: `out-${timestamp}`, text: outputText, type: 'error', category: 'internal', timestamp }];

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: 'W', text: `Attempted unknown internal command: ${commandName} (User: ${userId})` };
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
    return 'handle-not-found.ts';
}
