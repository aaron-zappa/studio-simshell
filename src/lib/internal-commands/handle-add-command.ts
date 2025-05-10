// src/lib/internal-commands/handle-add-command.ts
// src/lib/internal-commands/handle-add-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import the new LogEntry type
import type { CommandMode } from '@/types/command-types';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses the new LogEntry type
}


interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    command: string; // Original command string
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void; // Client-side function, problematic
    addCustomCommand: (name: string, action: CustomCommandAction) => void; // Client-side function, problematic
    currentLogEntries: LogEntry[]; // Pass current logs (uses new LogEntry type)
    initialSuggestions: Record<string, string[]>;
    overridePermissionChecks?: boolean;
}

// Make the function async
export const handleAddCommand = async (params: HandlerParams): Promise<HandlerResult> => {
    const { command, timestamp, addSuggestion, addCustomCommand, currentLogEntries, initialSuggestions, userPermissions, userId, overridePermissionChecks } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries]; // Start with a copy of current logs

    // Permission check bypassed if overridePermissionChecks is true
    // if (!overridePermissionChecks && !userPermissions.includes('manage_ai_tools')) { // Assuming same permission for simplicity
    //     const errorMsg = "Permission denied: Cannot add internal commands.";
    //     return {
    //         outputLines: [{ id: `add-cmd-perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }],
    //         newLogEntries: [...currentLogEntries, { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` }]
    //     };
    // }

    // Updated Regex for: add_int_cmd <short> <name> "<description>" <whatToDo>
    const addCmdRegex = /^add_int_cmd\s+(\S+)\s+(\S+)\s+"([^"]+)"\s+(.+)$/i;
    const match = command.match(addCmdRegex);

    let logType: 'I' | 'E' = 'I';
    let logText = '';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0; // Default flag is 0

    if (match && match[1] && match[2] && match[3] && match[4]) {
        const newCommandShort = match[1];
        const newCommandName = match[2];
        const newCommandDescription = match[3].trim();
        const newCommandAction = match[4].trim();

        if (initialSuggestions.internal.includes(newCommandName.toLowerCase())) {
            outputText = `Error: Cannot redefine built-in command "${newCommandName}".`;
            outputType = 'error';
            logType = 'E';
            logFlag = 0; // Set flag to 0 for error
            logText = outputText;
            outputLines = [{ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: 0 }];
        } else {
            // Note: Calling these client-side functions from a server action is problematic.
            try {
                 addSuggestion('internal', newCommandName);
                 addCustomCommand(newCommandName, newCommandAction);
            } catch (e) {
                console.warn("addSuggestion/addCustomCommand called in server context, may not behave as expected.", e)
            }

            // Format log and output text
            logText = `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Desc: "${newCommandDescription}". Action: "${newCommandAction}". (User: ${userId})`;
            outputText = `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Description: "${newCommandDescription}". Action: "${newCommandAction}". Logged to session log.`;
            outputType = 'info';
            logType = 'I';

            outputLines.push({ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: 0 });
        }
    } else {
        outputText = `Error: Invalid syntax. Use: add_int_cmd <short> <name> "<description>" <whatToDo>`;
        outputType = 'error';
        logType = 'E';
        logFlag = 0; // Set flag to 0 for error
        logText = outputText + ` (User: ${userId}, Command: ${command})`;
        outputLines = [{ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: 0 }];
    }

     // Add the log entry
    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    // Return output and the potentially updated log entries
    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-add-command.ts';
}
