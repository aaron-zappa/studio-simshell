// src/lib/internal-commands/handle-init.ts
// src/lib/internal-commands/handle-init.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';
import { storeVariableInDb } from '@/lib/variables';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

/**
 * Handles the 'init' command.
 * Initializes the database ('variables' table) and sets some default Python variables.
 */
export const handleInit = async ({ timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
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

    try {
        // 1. Initialize Database Table
        await runSql(createTableSql);
        const dbInitMsg = "Database initialized successfully. 'variables' table ensured.";
        logEntries.push({ timestamp, type: 'I', text: dbInitMsg });
        outputLines.push({ id: `init-db-${timestamp}`, text: dbInitMsg, type: 'info', category: 'internal', timestamp });

        // 2. Initialize Default Python Variables
        const defaultVars = [
            { name: 'max_iterations', value: '100', datatype: 'integer' },
            { name: 'learning_rate', value: '0.01', datatype: 'real' },
            { name: 'model_name', value: 'default_model', datatype: 'string' },
            { name: 'is_training_enabled', value: 'True', datatype: 'boolean' },
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
                logEntries.push({ timestamp, type: 'E', text: errorMsg });
                varErrors.push(errorMsg);
                overallSuccess = false;
            }
        }

        const varInitMsg = `Initialized ${varsAddedCount} default Python variable(s).`;
        logEntries.push({ timestamp, type: 'I', text: varInitMsg });
        outputLines.push({ id: `init-vars-${timestamp}`, text: varInitMsg, type: 'info', category: 'internal', timestamp });

        if (varErrors.length > 0) {
            outputLines.push({ id: `init-vars-err-${timestamp}`, text: `Errors encountered during variable initialization:\n${varErrors.join('\n')}`, type: 'error', category: 'internal', timestamp });
        }

        finalMessage = `Initialization complete. ${dbInitMsg} ${varInitMsg}`;
        if (!overallSuccess) {
             finalMessage += " Some errors occurred during variable initialization.";
        }


    } catch (error) {
        console.error("Error during initialization:", error);
        const errorMsg = `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logEntries.push({ timestamp, type: 'E', text: errorMsg });
        outputLines.push({ id: `init-error-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp });
        overallSuccess = false;
        finalMessage = errorMsg;
    }

    const combinedLogEntries = [...currentLogEntries, ...logEntries];

    return {
        outputLines,
        newLogEntries: combinedLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-init.ts';
}
