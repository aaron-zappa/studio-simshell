// src/lib/internal-commands/handle-init-db.ts
// src/lib/internal-commands/handle-init-db.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/lib/logging';
import { runSql } from '@/lib/database';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified
}

interface HandlerParams {
    timestamp: string;
}

/**
 * Handles the 'init db' command.
 * Creates the 'variables' table in the in-memory SQLite database.
 */
export const handleInitDb = async ({ timestamp }: HandlerParams): Promise<HandlerResult> => {
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

    try {
        // runSql already ensures the DB is initialized via getDb()
        await runSql(createTableSql);
        return {
            outputLines: [{
                id: `init-db-success-${timestamp}`,
                text: "Database initialized successfully. 'variables' table ensured.",
                type: 'info',
                category: 'internal'
            }]
        };
    } catch (error) {
        console.error("Error initializing database table:", error);
        return {
            outputLines: [{
                id: `init-db-error-${timestamp}`,
                text: `Error initializing database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error',
                category: 'internal'
            }]
        };
    }
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-init-db.ts';
}
