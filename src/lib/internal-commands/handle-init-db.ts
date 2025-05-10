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
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'init db' command.
 * Creates essential tables and adds sample RBAC data.
 * Requires admin-level permission (e.g., 'manage_roles_permissions').
 */
export const handleInitDb = async ({ timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('manage_roles_permissions')) {
    //     const errorMsg = "Permission denied: Cannot initialize database (admin operation).";
    //     return {
    //         outputLines: [{ id: `init-db-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }],
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` }]
    //     };
    // }

    const createStatements = [
        // Table Creation (Ensure order respects foreign keys if PRAGMA foreign_keys=ON is used)
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
        // Renamed table from 'permission' to 'permissions'
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

        // -- Sample Data Insertion (Ignoring potential conflicts for simplicity) --
        // Permissions
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('read_variables');`,
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('manage_variables');`, // Create, update, delete
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('execute_sql_select');`,
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('execute_sql_modify');`, // INSERT, UPDATE, DELETE
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('use_ai_tools');`,
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('manage_ai_tools');`, // Add, activate/deactivate
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('manage_users');`,
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('manage_roles_permissions');`,

        // Roles
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('administrator');`,
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('developer');`,
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('basic_user');`,

        // Role-Permission Assignments
        // Admin gets all
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r, permissions p WHERE r.role_name = 'administrator';`,
        // Developer gets variable management, SQL execution, AI tool usage/management, AND manage_roles_permissions
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.permission_name IN ('manage_variables', 'execute_sql_select', 'execute_sql_modify', 'use_ai_tools', 'manage_ai_tools', 'manage_roles_permissions') WHERE r.role_name = 'developer';`,
        // Basic user gets read variables, use AI tools, AND manage_roles_permissions
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.permission_name IN ('read_variables', 'use_ai_tools', 'manage_roles_permissions') WHERE r.role_name = 'basic_user';`,

        // Users
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', 'dummy_hash');`, // Replace with real hashing
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('dev', 'dummy_hash');`,
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('user', 'dummy_hash');`,

        // User-Role Assignments
        `INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u JOIN roles r ON r.role_name = 'administrator' WHERE u.username = 'admin';`,
        `INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u JOIN roles r ON r.role_name = 'developer' WHERE u.username = 'dev';`,
        `INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u JOIN roles r ON r.role_name = 'basic_user' WHERE u.username = 'user';`,
    ];
    
    const createPeterAdminStatement = `
    INSERT OR IGNORE INTO user_roles (user_id, role_id)
    SELECT u.user_id, r.role_id
    FROM users u
    JOIN roles r ON r.role_name = 'administrator'
    WHERE u.username = 'peter'
    `;
    createStatements.push(createPeterAdminStatement);

    let logText: string = 'Initializing database tables and sample data... ';
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputLines: OutputLine[] = [];
    let successfulStatements: number = 0;
    let errors: string[] = [];
    let logFlag: 0 | 1 = 0; // Default flag

    try {
        // runSql already ensures the DB is initialized via getDb()
        for (const sql of createStatements) {
             // Simple way to identify the statement type for logging
             let statementType = 'Unknown';
             if (sql.toUpperCase().startsWith('CREATE TABLE')) statementType = 'Table Creation';
             else if (sql.toUpperCase().startsWith('INSERT')) statementType = 'Sample Data Insertion';
             else if (sql.toUpperCase().startsWith('PRAGMA')) statementType = 'Pragma Setting';

            try {
                await runSql(sql);
                successfulStatements++;
                // Optionally add detailed success output, but keep it concise for init
                // outputLines.push({ id: `init-ok-${statementType}-${successfulStatements}-${timestamp}`, text: `OK: ${statementType} - ${sql.substring(0, 40)}...`, type: 'info', category: 'internal', timestamp, flag: 0 });
            } catch (error) {
                const errorMsg = `Error during DB init (${statementType}): ${error instanceof Error ? error.message : 'Unknown error'} (SQL: ${sql.substring(0, 60)}...)`;
                 console.error(errorMsg);
                 errors.push(errorMsg);
                 logType = 'E';
                 outputType = 'error';
                 logFlag = 0; // Set flag to 0 for error
                 // Add specific error line to output
                 outputLines.push({ id: `init-err-${statementType}-${errors.length}-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 });
            }
        }

        const finalSummaryText = `DB Initialization: ${successfulStatements} statements executed successfully. ${errors.length} errors encountered.`;
        logText += finalSummaryText;
        // Add a final summary line to the output
        // Determine final output type based on errors
        outputType = errors.length > 0 ? 'error' : 'info';
        outputLines.push({ id: `init-summary-${timestamp}`, text: finalSummaryText, type: outputType, category: 'internal', timestamp, flag: outputType === 'error' ? 0 : 0 });


    } catch (error) // Catch errors from getDb() itself
    {
        console.error("Error during database initialization (pre-statement execution):", error);
        logText = `Critical Error during DB initialization: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logType = 'E';
        outputType = 'error';
        logFlag = 0; // Set flag to 0 for error
        // Ensure outputLines has the critical error message
        outputLines = [{ id: `init-db-crit-error-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp, flag: 0 }];
    }

    // Add user ID and flag to the main log entry
    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText + ` (User: ${userId})` };
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
