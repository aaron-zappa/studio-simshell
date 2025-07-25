// src/lib/internal-commands/handle-add-ai-tool.ts
// src/lib/internal-commands/handle-add-ai-tool.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    command: string; // Original command string
    timestamp: string;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'add ai_tool' internal command.
 * Parses arguments and stores the tool's metadata (name, description, args_description)
 * in the 'ai_tools' SQLite table. Newly added tools are active by default.
 * Syntax: add ai_tool <toolname> "<args_description>" "<description>"
 * Requires 'manage_ai_tools' permission.
 */
export const handleAddAiTool = async (params: HandlerParams): Promise<HandlerResult> => {
    const { command, timestamp, currentLogEntries, userId, userPermissions, overridePermissionChecks } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0; // Default flag is 0

    // Permission Check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('manage_ai_tools')) {
    //     const errorMsg = "Permission denied: Cannot manage AI tools.";
    //     return {
    //         outputLines: [{ id: `add-tool-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }], // Error flag
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }] // Error flag
    //     };
    // }


    // Regex for: add ai_tool <toolname> "<args_description>" "<description>"
    const addToolRegex = /^add ai_tool\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"$/i;
    const match = command.match(addToolRegex);

    if (match && match[1] && match[2] && match[3]) {
        const toolName = match[1];
        const toolArgsDescription = match[2].trim();
        const toolDescription = match[3].trim();

        // Insert statement relies on the DEFAULT 1 for isactive on new entries.
        // The ON CONFLICT clause only updates description and args_description,
        // preserving the existing isactive state if the tool already exists.
        const insertSql = `
            INSERT INTO ai_tools (name, description, args_description)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                args_description = excluded.args_description;
        `;
        // Params match the INSERT columns (name, description, args_description)
        const insertParams = [toolName, toolDescription, toolArgsDescription];

        try {
            await runSql(insertSql, insertParams);
            outputText = `AI tool metadata stored/updated for: "${toolName}". Args Description: "${toolArgsDescription}", Description: "${toolDescription}". Tool is active by default or retains previous status.`;
            outputType = 'info';
            logText = outputText + ` (User: ${userId})`;
            logType = 'I';
            logFlag = 0;
            outputLines.push({ id: `add-tool-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        } catch (error) {
            console.error(`Error storing AI tool metadata for '${toolName}':`, error);
            outputText = `Error storing AI tool metadata: ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logText = outputText + ` (User: ${userId})`;
            logType = 'E';
            logFlag = 1; // Set flag to 1 for error
            outputLines.push({ id: `add-tool-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        }
    } else {
        // Update syntax error message
        outputText = `Error: Invalid syntax. Use: add ai_tool <toolname> "<args_description>" "<description>"`;
        outputType = 'error';
        logText = outputText + ` (User: ${userId}, Command: ${command})`;
        logType = 'E';
        logFlag = 1; // Set flag to 1 for error
        outputLines = [{ id: `add-tool-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }];
    }

    // Add log entry regardless of success/failure
    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
    };
};
