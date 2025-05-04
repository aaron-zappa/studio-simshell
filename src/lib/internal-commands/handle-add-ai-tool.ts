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
    command: string; // Original command string
    timestamp: string;
    currentLogEntries: LogEntry[];
}

/**
 * Handles the 'add ai_tool' internal command.
 * Parses arguments and stores the tool's metadata (name, description, args_description)
 * in the 'ai_tools' SQLite table.
 * Syntax: add ai_tool <toolname> "<description>" "<args_description>"
 */
export const handleAddAiTool = async (params: HandlerParams): Promise<HandlerResult> => {
    const { command, timestamp, currentLogEntries } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';

    // Corrected Regex for: add ai_tool <toolname> "<description>" "<args_description>"
    const addToolRegex = /^add ai_tool\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"$/i;
    const match = command.match(addToolRegex);

    if (match && match[1] && match[2] && match[3]) {
        const toolName = match[1];
        const toolDescription = match[2].trim(); // Correct: Description is the second quoted arg
        const toolArgsDescription = match[3].trim(); // Correct: Args description is the third quoted arg

        const insertSql = `
            INSERT INTO ai_tools (name, description, args_description)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                args_description = excluded.args_description;
        `;
        // Ensure params match the SQL query order
        const insertParams = [toolName, toolDescription, toolArgsDescription];

        try {
            await runSql(insertSql, insertParams);
            // Update feedback message to reflect correct order
            outputText = `AI tool metadata stored/updated for: "${toolName}". Description: "${toolDescription}", Args Description: "${toolArgsDescription}"`;
            outputType = 'info';
            logText = outputText;
            logType = 'I';
            outputLines.push({ id: `add-tool-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        } catch (error) {
            console.error(`Error storing AI tool metadata for '${toolName}':`, error);
            outputText = `Error storing AI tool metadata: ${error instanceof Error ? error.message : 'Unknown DB error'}`;
            outputType = 'error';
            logText = outputText;
            logType = 'E';
            outputLines.push({ id: `add-tool-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        }
    } else {
        // Update syntax error message
        outputText = `Error: Invalid syntax. Use: add ai_tool <toolname> "<description>" "<args_description>"`;
        outputType = 'error';
        logText = outputText;
        logType = 'E';
        outputLines = [{ id: `add-tool-syntax-err-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp }];
    }

    // Add log entry regardless of success/failure
    updatedLogEntries.push({ timestamp, type: logType, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-add-ai-tool.ts';
}
