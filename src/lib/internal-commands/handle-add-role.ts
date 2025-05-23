// src/lib/internal-commands/handle-add-role.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';
import type { HandlerResult } from './index';

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    args: string[]; // Expected: ['<role_name>']
    timestamp: string;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'add role <role_name>' internal command.
 * Inserts a new role into the 'roles' table.
 * Requires 'manage_roles_permissions' permission.
 */
export const handleAddRole = async (params: HandlerParams): Promise<HandlerResult> => {
    const { args, timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0;

    // Permission check is handled in the main internal command dispatcher if required by command definition

    if (args.length !== 1 || !args[0]) {
        outputText = `Error: Invalid syntax. Use: add role <role_name>`;
        outputType = 'error';
        logType = 'E';
        logFlag = 1;
        logText = `${outputText} (User: ${userId}, Args: ${args.join(' ')})`;
        outputLines.push({ id: `add-role-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
    } else {
        const roleName = args[0];
        const insertSql = `INSERT OR IGNORE INTO roles (role_name) VALUES (?);`;

        try {
            const { changes, lastInsertRowid } = await runSql(insertSql, [roleName]);

            if (changes !== null && changes > 0 && lastInsertRowid !== null && lastInsertRowid > 0) {
                outputText = `Role '${roleName}' added successfully with ID ${lastInsertRowid}.`;
                logText = `${outputText} (User: ${userId})`;
            } else if (changes === 0) {
                outputText = `Role '${roleName}' already exists.`;
                outputType = 'info'; // Not an error if it already exists
                logText = `${outputText} (User: ${userId})`;
            } else {
                outputText = `Failed to add role '${roleName}'. No changes were made to the database.`;
                outputType = 'error';
                logType = 'E';
                logFlag = 1;
                logText = `${outputText} (User: ${userId})`;
            }
            outputLines.push({ id: `add-role-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        } catch (error) {
            console.error(`Error adding role '${roleName}':`, error);
            outputText = `Error adding role '${roleName}': ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logType = 'E';
            logFlag = 1;
            logText = `${outputText} (User: ${userId})`;
            outputLines.push({ id: `add-role-db-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        }
    }

    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
    };
};
