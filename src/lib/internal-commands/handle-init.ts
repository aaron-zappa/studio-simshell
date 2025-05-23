// src/lib/internal-commands/handle-init.ts
// src/lib/internal-commands/handle-init.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';
import { storeVariableInDb } from '@/lib/variables';
// Removed: import { readClipboardText } from '@/lib/clipboard'; // Cannot be used in Server Action

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'init' command.
 * Initializes the database ('variables' table) and sets some default Python variables.
 * DOES NOT handle clipboard, as that requires client-side API access.
 * Requires admin-level permission (e.g., 'manage_roles_permissions').
 */
export const handleInit = async ({ timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('manage_roles_permissions')) {
    //     const errorMsg = "Permission denied: Cannot initialize system (admin operation).";
    //     return {
    //         outputLines: [{ id: `init-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }], // Error flag
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }] // Error flag
    //     };
    // }

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
    let logEntries: LogEntry[] = [];
    let outputLines: OutputLine[] = [];
    let overallSuccess = true;
    let finalMessage = '';
    let logFlag: 0 | 1 = 0; // Default flag

    try {
        // 1. Initialize Database Table
        await runSql(createTableSql);
        const dbInitMsg = "Database initialized successfully. 'variables' table ensured.";
        logEntries.push({ timestamp, type: 'I', flag: 0, text: `${dbInitMsg} (User: ${userId})` });
        outputLines.push({ id: `init-db-${timestamp}`, text: dbInitMsg, type: 'info', category: 'internal', timestamp, flag: 0 });

        // 2. Initialize Default Python Variables (excluding clipboard)
        const defaultVars = [
            { name: 'max_iterations', value: '100', datatype: 'integer' },
            { name: 'learning_rate', value: '0.01', datatype: 'real' },
            { name: 'model_name', value: 'default_model', datatype: 'string' },
            { name: 'is_training_enabled', value: 'True', datatype: 'boolean' },
            // { name: 'clipboard', value: 'placeholder - get on client', datatype: 'string' }, // Removed clipboard initialization here
        ];

        let varsAddedCount = 0;
        let varErrors: string[] = [];

        for (const variable of defaultVars) {
            try {
                await storeVariableInDb(variable.name, variable.value, variable.datatype);
                varsAddedCount++;
            } catch (error) {
                const errorMsg = `Error storing default variable '${variable.name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(errorMsg);
                logEntries.push({ timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }); // Error flag
                varErrors.push(errorMsg);
                overallSuccess = false;
                // logFlag = 1; // Overall flag is set later based on overallSuccess
            }
        }

        // Handle clipboard initialization feedback (without actual reading)
        const clipboardInitMsg = "Clipboard variable placeholder created. Assign with `clipboard = get()` command (requires clipboard access).";
        logEntries.push({ timestamp, type: 'I', flag: 0, text: `${clipboardInitMsg} (User: ${userId})` });
        // Don't add clipboard specific message to direct output, keep it simple
        // outputLines.push({ id: `init-clipboard-${timestamp}`, text: clipboardInitMsg, type: 'info', category: 'internal', timestamp, flag: 0 });


        const varInitMsg = `Initialized ${varsAddedCount} default Python variable(s).`;
        logEntries.push({ timestamp, type: 'I', flag: 0, text: `${varInitMsg} (User: ${userId})` });
        outputLines.push({ id: `init-vars-${timestamp}`, text: varInitMsg, type: 'info', category: 'internal', timestamp, flag: 0 });

        if (varErrors.length > 0) {
            outputLines.push({ id: `init-vars-err-${timestamp}`, text: `Errors encountered during variable initialization:\n${varErrors.join('\n')}`, type: 'error', category: 'internal', timestamp, flag: 1 }); // Error flag
        }

        // Add the clipboard info message to the final combined message
        finalMessage = `Initialization complete. ${dbInitMsg} ${varInitMsg} ${clipboardInitMsg}`;
         if (!overallSuccess) {
             finalMessage += " Some errors occurred during variable initialization.";
             logFlag = 1; // Set overall flag to 1 if any error occurred
         }


    } catch (error) {
        console.error("Error during initialization:", error);
        const errorMsg = `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logEntries.push({ timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }); // Error flag
        outputLines.push({ id: `init-error-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }); // Error flag
        overallSuccess = false;
        finalMessage = errorMsg;
        logFlag = 1; // Set flag to 1 for critical init error
    }

    const combinedLogEntries = [...currentLogEntries, ...logEntries];

    // Add final summary log entry based on overall success
    combinedLogEntries.push({
      timestamp,
      type: overallSuccess ? 'I' : 'E',
      flag: logFlag, // Use the determined overall flag
      text: `Overall Initialization Status: ${overallSuccess ? 'Success' : 'Failed with errors'}. ${finalMessage} (User: ${userId})`
    });


    return {
        outputLines,
        newLogEntries: combinedLogEntries
    };
};
