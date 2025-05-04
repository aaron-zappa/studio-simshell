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
 * Creates essential tables: 'variables', 'ai_tools', 'users', 'roles', 'user_roles', 'permissions', 'role_permissions'.
 */
export const handleInitDb = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const createStatements = [
        `CREATE TABLE IF NOT EXISTS variables (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            datatype VARCHAR(50) NOT NULL,
            value TEXT,
            max REAL,
            min REAL,
            default_value TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS ai_tools (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            description TEXT NOT NULL,
            args_description TEXT NOT NULL,
            isactive BOOLEAN NOT NULL DEFAULT 1
        );`,
        `CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash TEXT, -- Placeholder for secure password storage
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS roles (
            role_id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_name VARCHAR(50) NOT NULL UNIQUE
        );`,
        `CREATE TABLE IF NOT EXISTS permissions (
            permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
            permission_name VARCHAR(100) NOT NULL UNIQUE -- e.g., 'execute_sql', 'manage_variables'
        );`,
        `CREATE TABLE IF NOT EXISTS user_roles (
            user_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, role_id),
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions (permission_id) ON DELETE CASCADE
        );`,
        // Optionally enable foreign key support if needed (can impact performance slightly)
        // `PRAGMA foreign_keys = ON;`
    ];

    let logText: string = 'Initializing database tables... ';
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputLines: OutputLine[] = [];
    let successfulCreations: string[] = [];
    let errors: string[] = [];

    try {
        // runSql already ensures the DB is initialized via getDb()
        for (const sql of createStatements) {
             const tableNameMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
             const tableName = tableNameMatch ? tableNameMatch[1] : 'PRAGMA statement';
            try {
                await runSql(sql);
                successfulCreations.push(tableName);
                 outputLines.push({ id: `init-tbl-${tableName}-${timestamp}`, text: `Ensured '${tableName}' table exists.`, type: 'info', category: 'internal', timestamp });
            } catch (error) {
                const errorMsg = `Error creating/ensuring table '${tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                 console.error(errorMsg);
                 errors.push(errorMsg);
                 logType = 'E';
                 outputType = 'error';
                 outputLines.push({ id: `init-err-${tableName}-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp });
            }
        }

        if (errors.length > 0) {
            logText += `Completed with errors. ${successfulCreations.length} tables OK, ${errors.length} errors.`;
        } else {
             logText += `Successfully ensured ${successfulCreations.length} tables exist.`;
             outputType = 'info'; // Ensure output type is info if no errors
        }

    } catch (error) // Catch errors from getDb() itself
    {
        console.error("Error during database initialization (pre-table creation):", error);
        logText = `Critical Error during DB initialization: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logType = 'E';
        outputType = 'error';
        outputLines = [{ id: `init-db-crit-error-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp }];
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
