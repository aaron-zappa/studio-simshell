// src/lib/internal-commands/handle-set-ai-tool-active.ts
// src/lib/internal-commands/handle-set-ai-tool-active.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    args: string[]; // Expected: ['<name>', 'active', <0|1>] - index.ts passes args starting *after* 'set ai_tool'
    timestamp: string;
    currentLogEntries: LogEntry[];
}

/**
 * Handles the 'set ai_tool <name> active <0|1>' internal command.
 * Updates the 'isactive' status of a specified AI tool in the database.
 * Requires 'manage_ai_tools' permission.
 */
export const handleSetAiToolActive = async (params: HandlerParams): Promise<HandlerResult> => {
    const { args, timestamp, currentLogEntries, userId, userPermissions } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'W' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0; // Default flag

    // Permission check moved to central handler

    // Validate arguments: <name> active <0|1> (args array starts after 'set ai_tool')
    if (args.length !== 3 || args[1] !== 'active' || (args[2] !== '0' && args[2] !== '1')) {
         // Adjusted args index check based on how index.ts passes args (excluding 'set' and 'ai_tool')
        outputText = `Error: Invalid syntax. Use: set ai_tool <name> active <0|1>`;
        outputType = 'error';
        logType = 'E';
        logFlag = 0; // Set flag to 0 for error
        logText = outputText + ` (User: ${userId}, Command: set ai_tool ${args.join(' ')})`;
        outputLines = [{ id: `set-tool-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }];
    } else {
        const toolName = args[0]; // Tool name is the first arg after 'set ai_tool'
        const isActiveValue = parseInt(args[2], 10); // 0 or 1 is the third arg

        const updateSql = `UPDATE ai_tools SET isactive = ? WHERE name = ?;`;
        const updateParams = [isActiveValue, toolName];

        try {
            const { changes } = await runSql(updateSql, updateParams);

            if (changes !== null && changes > 0) {
                outputText = `AI tool '${toolName}' set to ${isActiveValue === 1 ? 'active' : 'inactive'}.`;
                outputType = 'info';
                logText = outputText + ` (User: ${userId})`;
                logType = 'I';
                outputLines.push({ id: `set-tool-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            } else {
                outputText = `Error: AI tool '${toolName}' not found.`;
                outputType = 'error'; // Changed to error as it's a failed operation
                logType = 'W'; // Warning because the command was valid but target not found
                logFlag = 1; // Set flag for warning (target not found is a recoverable issue)
                logText = outputText + ` (User: ${userId})`;
                outputLines.push({ id: `set-tool-notfound-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            }
        } catch (error) {
            console.error(`Error updating AI tool status for '${toolName}':`, error);
            outputText = `Error updating AI tool status: ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logText = outputText + ` (User: ${userId})`;
            logType = 'E';
            logFlag = 0; // Set flag to 0 for error
            outputLines.push({ id: `set-tool-db-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        }
    }

    // Add log entry regardless of success/failure
    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-set-ai-tool-active.ts';
}
