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
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Default filename for export db command
const DEFAULT_EXPORT_FILENAME = 'simshell_export.db'; // Updated default name

/**
 * Handles the 'export db' internal command.
 * Persists the current database state to a default file name ('simshell_export.db') in the 'data' directory.
 */
export const handleExportDb = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;

    const targetFilename = DEFAULT_EXPORT_FILENAME;

    try {
        const success = await persistDbToFile(targetFilename);
        if (success) {
            // Slightly rephrased success message
            outputText = `Database successfully exported to: data/${targetFilename}`;
            outputType = 'info';
            logText = outputText;
        } else {
             // This case might not be reachable if persistDbToFile throws on failure
            outputText = `Failed to export database to ${targetFilename} for an unknown reason.`;
            outputType = 'error';
            logType = 'E';
            logText = outputText;
        }
    } catch (error) {
        console.error("Error during database export:", error);
        outputText = `Error exporting database to ${targetFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logType = 'E';
        logText = outputText;
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{ id: `export-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }],
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
