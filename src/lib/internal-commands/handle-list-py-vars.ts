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
    timestamp: string;
    currentLogEntries: LogEntry[];
}

/**
 * Handles the 'list py vars' command.
 * Retrieves and displays all variables stored in the database.
 */
export const handleListPyVars = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const sql = 'SELECT name, datatype, value FROM variables ORDER BY name';
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'output';
    let outputText: string;

    try {
        const { results } = await runSql(sql);

        if (results && results.length > 0) {
             const formattedTable = formatResultsAsTable(results);
             outputText = formattedTable || "No variables found."; // formatResultsAsTable returns null on empty input, but we check length > 0
             logText = `Listed ${results.length} variable(s) from database.`;
        } else {
             outputText = "No variables found in the database.";
             logText = "No variables found when listing.";
             outputType = 'info'; // Use info type for "no results"
        }
    } catch (error) {
        console.error("Error retrieving variables:", error);
        outputText = `Error retrieving variables: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logText = outputText;
        logType = 'E';
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{
            id: `list-vars-${timestamp}`,
            text: outputText,
            type: outputType,
            category: 'internal',
            timestamp: outputType === 'error' ? timestamp : undefined // Add timestamp only for errors
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
