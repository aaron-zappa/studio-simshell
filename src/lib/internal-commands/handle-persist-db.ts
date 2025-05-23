// src/lib/internal-commands/handle-persist-db.ts
// src/lib/internal-commands/handle-persist-db.ts
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
    args: string[]; // Includes 'memory', 'db', 'to', and optionally '<filename.db>'
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
    overridePermissionChecks?: boolean;
}

const DEFAULT_PERSIST_FILENAME = 'sim_shell.db';

export const handlePersistDb = async ({ args, timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('execute_sql_modify')) {
    //     const errorMsg = "Permission denied: Cannot persist database.";
    //     return {
    //         outputLines: [{ id: `persist-db-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }], // Error flag
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }] // Error flag
    //     };
    // }

    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let logFlag: 0 | 1 = 0; // Default flag

    let targetFilename: string;

    // Expected command: persist memory db to [<filename.db>]
    if (args.length === 3 && args[0] === 'memory' && args[1] === 'db' && args[2] === 'to') {
        targetFilename = DEFAULT_PERSIST_FILENAME; // No filename provided, use default
    } else if (args.length === 4 && args[0] === 'memory' && args[1] === 'db' && args[2] === 'to') {
        targetFilename = args[3];
    } else {
        outputText = 'Error: Invalid syntax. Use: persist memory db to [<filename.db>]';
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Set flag to 1 for error
        logText = outputText + ` (User: ${userId}, Command: persist ${args.join(' ')})`;
        const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
        const newLogEntries = [...currentLogEntries, logEntry];
        return {
            outputLines: [{ id: `persist-db-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }],
            newLogEntries
        };
    }

    try {
        const success = await persistDbToFile(targetFilename);
        if (success) {
            outputText = `Successfully persisted in-memory database to file: data/${targetFilename}`;
            outputType = 'info';
            logText = outputText + ` (User: ${userId})`;
            logFlag = 0;
        } else {
             // This case might not be reachable if persistDbToFile throws on failure
            outputText = 'Failed to persist database for an unknown reason.';
            outputType = 'error';
            logType = 'E';
            logFlag = 1; // Set flag to 1 for error
            logText = outputText + ` (User: ${userId})`;
        }
    } catch (error) {
        console.error("Error during database persistence:", error);
        outputText = `Error persisting database to data/${targetFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Set flag to 1 for error
        logText = outputText + ` (User: ${userId})`;
    }


    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{ id: `persist-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }],
        newLogEntries
    };
};
