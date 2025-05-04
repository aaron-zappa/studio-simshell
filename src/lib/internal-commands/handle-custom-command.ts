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
    timestamp: string;
    commandName: string; // Needed for logging
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Update function signature to return HandlerResult
export const handleCustomCommand = async (params: HandlerParams, action: CustomCommandAction): Promise<HandlerResult> => {
    const { timestamp, commandName, currentLogEntries } = params;
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

    const outputText = action; // Action is the output for now
    const outputLines = [{ id: `out-${timestamp}`, text: outputText, type: 'output', category: 'internal' }];

    // Create log entry
    const logEntry: LogEntry = {
        timestamp,
        type: 'I',
        text: `Executed custom command '${commandName}'. Output: ${outputText}`
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
