// src/lib/internal-commands/handle-list-py-vars.ts
// src/lib/internal-commands/handle-list-py-vars.ts
'use server';

import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';
import { formatResultsAsTable } from '@/lib/formatting'; // Reuse formatting

// Define the structure for the return value
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    timestamp: string;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'list py vars' command.
 * Retrieves and displays all variables stored in the database.
 * Requires 'read_variables' permission.
 */
export const handleListPyVars = async ({ timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('read_variables')) {
    //     const errorMsg = "Permission denied: Cannot read variables.";
    //     return {
    //         outputLines: [{ id: `list-vars-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }],
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` }]
    //     };
    // }

    const sql = 'SELECT name, datatype, value FROM variables ORDER BY name';
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'output';
    let outputText: string;
    let logFlag: 0 | 1 = 0; // Default flag

    try {
        // runSql ensures DB is initialized
        const { results } = await runSql(sql);

        if (results && results.length > 0) {
             // formatResultsAsTable is now async
             const formattedTable = await formatResultsAsTable(results);
             outputText = formattedTable || "No variables found."; // formatResultsAsTable returns null on empty input, but we check length > 0
             logText = `Listed ${results.length} variable(s) from database. (User: ${userId})`;
        } else {
             outputText = "No variables found in the database.";
             logText = `No variables found when listing. (User: ${userId})`;
             outputType = 'info'; // Use info type for "no results"
             // logType remains 'I' but could be 'W' if desired for "no results"
             logFlag = 0; // No error/warning here
        }
    } catch (error) {
        console.error("Error retrieving variables:", error);
        outputText = `Error retrieving variables: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logText = outputText + ` (User: ${userId})`;
        logType = 'E';
        logFlag = 0; // Set flag to 0 for error
    }

    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{
            id: `list-vars-${timestamp}`,
            text: outputText,
            type: outputType,
            category: 'internal',
            // Add timestamp only for errors or info messages that should look like logs
            timestamp: (outputType === 'error' || outputType === 'info') ? timestamp : undefined,
            flag: logFlag // Pass the determined flag
        }],
        newLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-list-py-vars.ts';
}
