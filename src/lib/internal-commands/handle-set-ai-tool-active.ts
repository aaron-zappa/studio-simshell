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
    args: string[]; // Expected: ['ai_tool', <name>, 'active', <0|1>]
    timestamp: string;
    currentLogEntries: LogEntry[];
}

/**
 * Handles the 'set ai_tool <name> active <0|1>' internal command.
 * Updates the 'isactive' status of a specified AI tool in the database.
 */
export const handleSetAiToolActive = async (params: HandlerParams): Promise<HandlerResult> => {
    const { args, timestamp, currentLogEntries } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'W' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';

    // Validate arguments: set ai_tool <name> active <0|1>
    if (args.length !== 4 || args[0] !== 'ai_tool' || args[2] !== 'active' || (args[3] !== '0' && args[3] !== '1')) {
        outputText = `Error: Invalid syntax. Use: set ai_tool <name> active <0|1>`;
        outputType = 'error';
        logType = 'E';
        logText = outputText;
        outputLines = [{ id: `set-tool-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }];
    } else {
        const toolName = args[1];
        const isActiveValue = parseInt(args[3], 10); // 0 or 1

        const updateSql = `UPDATE ai_tools SET isactive = ? WHERE name = ?;`;
        const updateParams = [isActiveValue, toolName];

        try {
            const { changes } = await runSql(updateSql, updateParams);

            if (changes !== null && changes > 0) {
                outputText = `AI tool '${toolName}' set to ${isActiveValue === 1 ? 'active' : 'inactive'}.`;
                outputType = 'info';
                logText = outputText;
                logType = 'I';
                outputLines.push({ id: `set-tool-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            } else {
                outputText = `Error: AI tool '${toolName}' not found.`;
                outputType = 'error';
                logType = 'W'; // Warning because the command was valid but target not found
                logText = outputText;
                outputLines.push({ id: `set-tool-notfound-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            }
        } catch (error) {
            console.error(`Error updating AI tool status for '${toolName}':`, error);
            outputText = `Error updating AI tool status: ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logText = outputText;
            logType = 'E';
            outputLines.push({ id: `set-tool-db-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        }
    }

    // Add log entry regardless of success/failure
    updatedLogEntries.push({ timestamp, type: logType, text: logText });

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
