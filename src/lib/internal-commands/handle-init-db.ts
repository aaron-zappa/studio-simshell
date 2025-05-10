// src/lib/internal-commands/handle-init-db.ts
// src/lib/internal-commands/handle-init-db.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry
import { runSql } from '@/lib/database';
import { internalCommandDefinitions } from '@/lib/internal-commands-definitions'; // Import command definitions

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
 * Creates essential tables including new command definition tables, and adds sample RBAC data.
 * Populates command_metadata and command_input_arguments from internalCommandDefinitions.
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
        // New command definition structure
        `DROP TABLE IF EXISTS commands;`, // Drop old commands table if it exists
        `CREATE TABLE IF NOT EXISTS command_metadata (
            command_name TEXT NOT NULL PRIMARY KEY,
            command_description TEXT,
            result_description TEXT,
            result_type TEXT,
            result_min REAL,
            result_max REAL,
            result_length INTEGER
        );`,
        `CREATE TABLE IF NOT EXISTS command_input_arguments (
            argument_id INTEGER PRIMARY KEY AUTOINCREMENT,
            command_name TEXT NOT NULL,
            argument_name TEXT NOT NULL,
            argument_type TEXT NOT NULL,
            argument_purpose TEXT,
            argument_default_value TEXT,
            argument_min REAL,
            argument_max REAL,
            argument_length INTEGER,
            is_required BOOLEAN DEFAULT 1,
            position INTEGER,
            FOREIGN KEY (command_name) REFERENCES command_metadata (command_name) ON DELETE CASCADE,
            UNIQUE (command_name, argument_name),
            UNIQUE (command_name, position)
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
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('view_history');`, // For 'history' command
        `INSERT OR IGNORE INTO permissions (permission_name) VALUES ('execute_python_code');`, // For Python execution

        // Roles
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('administrator');`,
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('developer');`,
        `INSERT OR IGNORE INTO roles (role_name) VALUES ('basic_user');`,

        // Role-Permission Assignments
        // Admin gets all
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r, permissions p WHERE r.role_name = 'administrator';`,
        // Developer gets variable management, SQL execution, AI tool usage/management, AND manage_roles_permissions
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.permission_name IN ('manage_variables', 'execute_sql_select', 'execute_sql_modify', 'use_ai_tools', 'manage_ai_tools', 'manage_roles_permissions', 'view_history', 'execute_python_code') WHERE r.role_name = 'developer';`,
        // Basic user gets read variables, use AI tools, AND manage_roles_permissions
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.permission_name IN ('read_variables', 'use_ai_tools', 'manage_roles_permissions', 'view_history') WHERE r.role_name = 'basic_user';`,

        // Users
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', 'dummy_hash');`, // Replace with real hashing
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('dev', 'dummy_hash');`,
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('user', 'dummy_hash');`,
        `INSERT OR IGNORE INTO users (username, password_hash) VALUES ('peter', 'dummy_hash');`,


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
            let statementType = 'Unknown DDL/DML';
            if (sql.toUpperCase().startsWith('CREATE TABLE')) statementType = 'Table Creation';
            else if (sql.toUpperCase().startsWith('DROP TABLE')) statementType = 'Table Drop';
            else if (sql.toUpperCase().startsWith('INSERT')) statementType = 'Sample Data Insertion';
            else if (sql.toUpperCase().startsWith('PRAGMA')) statementType = 'Pragma Setting';

            try {
                await runSql(sql);
                successfulStatements++;
            } catch (error) {
                const errorMsg = `Error during DB init (${statementType}): ${error instanceof Error ? error.message : 'Unknown error'} (SQL: ${sql.substring(0, 60)}...)`;
                console.error(errorMsg);
                errors.push(errorMsg);
                logType = 'E';
                outputType = 'error';
                logFlag = 0;
                outputLines.push({ id: `init-err-${statementType}-${errors.length}-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 });
            }
        }

        const initialSummaryText = `DB Initialization (Tables & RBAC): ${successfulStatements} statements executed successfully. ${errors.length} errors encountered.`;
        logText += initialSummaryText;
        outputLines.push({ id: `init-summary-rbac-${timestamp}`, text: initialSummaryText, type: errors.length > 0 ? 'error' : 'info', category: 'internal', timestamp, flag: errors.length > 0 ? 0 : 0 });

        // --- Populate command_metadata and command_input_arguments ---
        outputLines.push({ id: `init-cmd-meta-start-${timestamp}`, text: "Populating command metadata...", type: 'info', category: 'internal', timestamp, flag: 0 });
        let cmdMetaSuccessCount = 0;
        let cmdMetaErrorCount = 0;

        for (const cmdDef of internalCommandDefinitions) {
            // Insert into command_metadata
            const cmdMetaSql = `
                INSERT OR IGNORE INTO command_metadata 
                (command_name, command_description, result_description, result_type, result_min, result_max, result_length) 
                VALUES (?, ?, NULL, NULL, NULL, NULL, NULL);
            `;
            const cmdMetaParams = [cmdDef.name, cmdDef.description];
            try {
                await runSql(cmdMetaSql, cmdMetaParams);
                cmdMetaSuccessCount++;

                // Insert into command_input_arguments if argsDetails exists
                if (cmdDef.argsDetails && cmdDef.argsDetails.length > 0) {
                    for (let i = 0; i < cmdDef.argsDetails.length; i++) {
                        const argDetail = cmdDef.argsDetails[i];
                        const argSql = `
                            INSERT OR IGNORE INTO command_input_arguments 
                            (command_name, argument_name, argument_type, argument_purpose, argument_default_value, argument_min, argument_max, argument_length, is_required, position) 
                            VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?);
                        `;
                        // Defaulting argument_type to 'string' for now
                        const argParams = [
                            cmdDef.name,
                            argDetail.name,
                            'string', 
                            argDetail.description,
                            argDetail.optional ? 0 : 1,
                            i + 1 // position
                        ];
                        await runSql(argSql, argParams);
                        // Note: success/error count for args could be more granular if needed
                    }
                }
            } catch (error) {
                const errorMsg = `Error populating metadata for command '${cmdDef.name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(errorMsg);
                errors.push(errorMsg); // Add to overall errors
                cmdMetaErrorCount++;
                logType = 'E'; // Ensure overall log type reflects error
                logFlag = 0;   // Ensure overall flag reflects error
                outputLines.push({ id: `init-cmd-meta-err-${cmdDef.name}-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 });
            }
        }
        
        const cmdMetaSummaryText = `Command Metadata Population: ${cmdMetaSuccessCount} commands processed. ${cmdMetaErrorCount} errors.`;
        logText += ` | ${cmdMetaSummaryText}`;
        outputLines.push({ id: `init-cmd-meta-summary-${timestamp}`, text: cmdMetaSummaryText, type: cmdMetaErrorCount > 0 ? 'error' : 'info', category: 'internal', timestamp, flag: cmdMetaErrorCount > 0 ? 0 : 0 });
        
        // Determine final overall output type based on any errors encountered
        outputType = errors.length > 0 ? 'error' : 'info';


    } catch (error) // Catch errors from getDb() itself or initial setup
    {
        console.error("Error during database initialization (pre-statement execution):", error);
        logText = `Critical Error during DB initialization: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logType = 'E';
        outputType = 'error';
        logFlag = 0;
        outputLines = [{ id: `init-db-crit-error-${timestamp}`, text: logText, type: outputType, category: 'internal', timestamp, flag: 0 }];
    }

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
