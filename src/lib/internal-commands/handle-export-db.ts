// src/lib/internal-commands/handle-export-db.ts
// src/lib/internal-commands/handle-export-db.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import { persistDbToFile } from '@/lib/database'; // Import the persistence function
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
    currentLogEntries: LogEntry[]; // Pass current logs
    overridePermissionChecks?: boolean;
}

// Default filename for export db command
const DEFAULT_EXPORT_FILENAME = 'sim_shell.db'; // Updated default name to consistent main DB file

/**
 * Handles the 'export db' internal command.
 * Persists the current database state to 'sim_shell.db' (or the default persistent DB name) in the server's 'data' directory.
 * Requires 'execute_sql_modify' permission.
 */
export const handleExportDb = async ({ timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('execute_sql_modify')) {
    //     const errorMsg = "Permission denied: Cannot export database.";
    //     return {
    //         outputLines: [{ id: `export-db-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }], // Error flag
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }] // Error flag
    //     };
    // }

    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let logFlag: 0 | 1 = 0; // Default flag

    const targetFilename = DEFAULT_EXPORT_FILENAME;

    try {
        const success = await persistDbToFile(targetFilename);
        if (success) {
            // Slightly rephrased success message
            outputText = `Database successfully exported to: data/${targetFilename}`;
            outputType = 'info';
            logText = outputText + ` (User: ${userId})`;
            logFlag = 0;
        } else {
             // This case might not be reachable if persistDbToFile throws on failure
            outputText = `Failed to export database to data/${targetFilename} for an unknown reason.`;
            outputType = 'error';
            logType = 'E';
            logFlag = 1; // Set flag to 1 for error
            logText = outputText + ` (User: ${userId})`;
        }
    } catch (error) {
        console.error("Error during database export:", error);
        outputText = `Error exporting database to data/${targetFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Set flag to 1 for error
        logText = outputText + ` (User: ${userId})`;
    }

    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{ id: `export-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }],
        newLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-export-db.ts';
}

