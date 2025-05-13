// src/lib/internal-commands/handle-not-found.ts
// src/lib/internal-commands/handle-not-found.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import type { HandlerResult } from './index'; // Import HandlerResult from parent index

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    commandName: string;
    timestamp: string;
    currentLogEntries: LogEntry[];
}

export const handleNotFound = async ({ commandName, timestamp, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    const outputText = `Internal command not found: ${commandName}`;
    const outputLines: OutputLine[] = [{ id: `out-${timestamp}`, text: outputText, type: 'error', category: 'internal', timestamp, flag: 0 }];

    const logEntry: LogEntry = { timestamp, type: 'W', flag: 1, text: `Attempted unknown internal command: ${commandName} (User: ${userId})` };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: outputLines,
        newLogEntries: newLogEntries,
        newSuggestions: undefined,
        newCustomCommands: undefined,
        toastInfo: undefined
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-not-found.ts';
}
