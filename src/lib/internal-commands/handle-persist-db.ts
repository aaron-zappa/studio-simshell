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
    args: string[]; // Includes 'memory', 'db', 'to', '<filename.db>'
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

export const handlePersistDb = async ({ args, timestamp, currentLogEntries, userId, userPermissions }: HandlerParams): Promise<HandlerResult> => {
    // Permission check moved to central handler
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;


    // Expected command: persist memory db to <filename.db>
    if (args.length !== 4 || args[0] !== 'memory' || args[1] !== 'db' || args[2] !== 'to') {
        outputText = 'Error: Invalid syntax. Use: persist memory db to <filename.db>';
        outputType = 'error';
        logType = 'E';
        logText = outputText + ` (User: ${userId}, Command: persist ${args.join(' ')})`;
    } else {
        const targetFilename = args[3];
        try {
            const success = await persistDbToFile(targetFilename);
            if (success) {
                outputText = `Successfully persisted in-memory database to file: data/${targetFilename}`;
                outputType = 'info';
                logText = outputText + ` (User: ${userId})`;
            } else {
                 // This case might not be reachable if persistDbToFile throws on failure
                outputText = 'Failed to persist database for an unknown reason.';
                outputType = 'error';
                logType = 'E';
                logText = outputText + ` (User: ${userId})`;
            }
        } catch (error) {
            console.error("Error during database persistence:", error);
            outputText = `Error persisting database: ${error instanceof Error ? error.message : 'Unknown error'}`;
            outputType = 'error';
            logType = 'E';
            logText = outputText + ` (User: ${userId})`;
        }
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{ id: `persist-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }],
        newLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-persist-db.ts';
}
