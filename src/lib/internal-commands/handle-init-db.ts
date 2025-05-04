// src/lib/internal-commands/handle-init-db.ts
// src/lib/internal-commands/handle-init-db.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry
import { runSql } from '@/lib/database';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses new LogEntry type
}

interface HandlerParams {
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

/**
 * Handles the 'init db' command.
 * Creates the 'variables' table in the in-memory SQLite database.
 */
export const handleInitDb = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS variables (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            datatype VARCHAR(50) NOT NULL,
            value TEXT,
            max REAL,
            min REAL,
            default_value TEXT
        );
    `;
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';

    try {
        // runSql already ensures the DB is initialized via getDb()
        await runSql(createTableSql);
        logText = "Database initialized successfully. 'variables' table ensured.";
        outputType = 'info';
    } catch (error) {
        console.error("Error initializing database table:", error);
        logText = `Error initializing database: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logType = 'E';
        outputType = 'error';
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: [{
            id: `init-db-${outputType === 'info' ? 'success' : 'error'}-${timestamp}`,
            text: logText,
            type: outputType,
            category: 'internal'
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
    return 'handle-init-db.ts';
}
