// src/lib/internal-commands/handle-set-sim-mode.ts
// src/lib/internal-commands/handle-set-sim-mode.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { storeVariableInDb } from '@/lib/variables';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    args: string[]; // Expected: ['<0|1>']
    timestamp: string;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'set sim_mode <0|1>' internal command.
 * Sets the 'sim_mode' internal variable to 0 or 1.
 * Requires 'manage_variables' permission (or override).
 */
export const handleSetSimMode = async (params: HandlerParams): Promise<HandlerResult> => {
    const { args, timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0;

    // Permission check moved to src/lib/internal-commands/index.ts

    if (args.length !== 1 || (args[0] !== '0' && args[0] !== '1')) {
        outputText = `Error: Invalid syntax. Use: set sim_mode <0|1>`;
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Error flag
        logText = outputText + ` (User: ${userId}, Command: set sim_mode ${args.join(' ')})`;
        outputLines.push({ id: `set-sim-mode-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
    } else {
        const simModeValue = parseInt(args[0], 10);

        try {
            await storeVariableInDb('sim_mode', String(simModeValue), 'integer');
            outputText = `Simulation mode set to ${simModeValue}.`;
            outputType = 'info';
            logText = outputText + ` (User: ${userId})`;
            logType = 'I';
            logFlag = 0;
            outputLines.push({ id: `set-sim-mode-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        } catch (error) {
            console.error(`Error setting simulation mode:`, error);
            outputText = `Error setting simulation mode: ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logText = outputText + ` (User: ${userId})`;
            logType = 'E';
            logFlag = 1; // Error flag
            outputLines.push({ id: `set-sim-mode-db-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        }
    }

    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
    };
};
