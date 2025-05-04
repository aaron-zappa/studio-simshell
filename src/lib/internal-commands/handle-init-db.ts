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
 * Creates the 'variables' and 'ai_tools' tables in the in-memory SQLite database.
 */
export const handleInitDb = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const createVariablesTableSql = `
        CREATE TABLE IF NOT EXISTS variables (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            datatype VARCHAR(50) NOT NULL,
            value TEXT,
            max REAL,
            min REAL,
            default_value TEXT
        );
    `;
    // Define the SQL to create the ai_tools table
    const createAiToolsTableSql = `
        CREATE TABLE IF NOT EXISTS ai_tools (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            description TEXT NOT NULL,
            args_description TEXT NOT NULL
        );
    `;

    let logText: string = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputLines: OutputLine[] = [];

    try {
        // runSql already ensures the DB is initialized via getDb()
        await runSql(createVariablesTableSql);
        logText += "Ensured 'variables' table exists. ";
        outputLines.push({ id: `init-vars-table-${timestamp}`, text: "Ensured 'variables' table exists.", type: 'info', category: 'internal', timestamp });

        // Execute the SQL to create the ai_tools table
        await runSql(createAiToolsTableSql);
        logText += "Ensured 'ai_tools' table exists.";
        outputLines.push({ id: `init-tools-table-${timestamp}`, text: "Ensured 'ai_tools' table exists.", type: 'info', category: 'internal', timestamp });

        logText = "Database initialized successfully. " + logText;
        outputType = 'info';
    } catch (error) {
        console.error("Error initializing database tables:", error);
        logText = `Error initializing database tables: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logType = 'E';
        outputType = 'error';
        // Overwrite previous lines with the error message
        outputLines = [{ id: `init-db-error-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp }];
    }

    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines,
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
