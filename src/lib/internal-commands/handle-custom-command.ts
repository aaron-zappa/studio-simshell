// src/lib/internal-commands/handle-custom-command.ts
// src/lib/internal-commands/handle-custom-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';
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
    commandName: string; // Needed for logging
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Update function signature to return HandlerResult
export const handleCustomCommand = async (params: HandlerParams, action: CustomCommandAction): Promise<HandlerResult> => {
    const { timestamp, commandName, currentLogEntries, userId, userPermissions } = params;
    // Permission check moved to central handler

    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

    const outputText = action; // Action is the output for now
    const outputLines = [{ id: `out-${timestamp}`, text: outputText, type: 'output', category: 'internal', timestamp }];

    // Create log entry with flag=0
    const logEntry: LogEntry = {
        timestamp,
        type: 'I',
        flag: 0, // Default flag
        text: `Executed custom command '${commandName}'. Output: ${outputText} (User: ${userId})`
    };
    const newLogEntries = [...currentLogEntries, logEntry];

    return { outputLines: outputLines, newLogEntries: newLogEntries };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-custom-command.ts';
}