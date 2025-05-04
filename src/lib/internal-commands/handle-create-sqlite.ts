// src/lib/internal-commands/handle-create-sqlite.ts
// src/lib/internal-commands/handle-create-sqlite.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified
}


interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    args: string[];
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

export const handleCreateSqlite = async ({ args, timestamp, currentLogEntries, userId, userPermissions }: HandlerParams): Promise<HandlerResult> => {
    // Permission check moved to central handler
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText = '';

    if (args.length < 1) { // Check if 'sqlite' keyword is present (or just filename)
        outputText = `Error: Invalid syntax. Use: create sqlite <filename.db> (filename is ignored, uses in-memory DB)`;
        outputType = 'error';
        logType = 'E';
        logText = outputText + ` (User: ${userId}, Command: create ${args.join(' ')})`;
    } else {
         // Simulate a brief action, actual DB init is deferred to first use or 'init db'.
         await new Promise(resolve => setTimeout(resolve, 100));
         outputText = `Internal SQLite in-memory database is ready. Use SQL commands directly. (Filename argument is ignored).`;
         logType = 'I';
         logText = outputText + ` (User: ${userId})`;
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
         outputLines: [{ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }],
         newLogEntries: newLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-create-sqlite.ts';
}
