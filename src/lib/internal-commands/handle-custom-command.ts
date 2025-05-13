// src/lib/internal-commands/handle-custom-command.ts
// src/lib/internal-commands/handle-custom-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { LogEntry } from '@/types/log-types';
import type { HandlerResult } from './index'; // Import HandlerResult from parent index

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    timestamp: string;
    commandName: string;
    currentLogEntries: LogEntry[];
}

export const handleCustomCommand = async (params: HandlerParams, action: CustomCommandAction): Promise<HandlerResult> => {
    const { timestamp, commandName, currentLogEntries, userId, userPermissions } = params;

    await new Promise(resolve => setTimeout(resolve, 500));

    const outputText = action;
    const outputLines: OutputLine[] = [{ id: `out-${timestamp}`, text: outputText, type: 'output', category: 'internal', timestamp, flag: 0 }]; // Added flag

    const logEntry: LogEntry = {
        timestamp,
        type: 'I',
        flag: 0,
        text: `Executed custom command '${commandName}'. Output: ${outputText} (User: ${userId})`
    };
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
    return 'handle-custom-command.ts';
}
