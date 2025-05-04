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
    command: string; // Original command string
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void; // Client-side function, problematic
    addCustomCommand: (name: string, action: CustomCommandAction) => void; // Client-side function, problematic
    currentLogEntries: LogEntry[]; // Pass current logs (uses new LogEntry type)
    initialSuggestions: Record<string, string[]>;
}

// Make the function async
export const handleAddCommand = async (params: HandlerParams): Promise<HandlerResult> => {
    const { command, timestamp, addSuggestion, addCustomCommand, currentLogEntries, initialSuggestions } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries]; // Start with a copy of current logs

    // Updated Regex for: add_int_cmd <short> <name> "<description>" <whatToDo>
    const addCmdRegex = /^add_int_cmd\s+(\S+)\s+(\S+)\s+"([^"]+)"\s+(.+)$/i;
    const match = command.match(addCmdRegex);

    if (match && match[1] && match[2] && match[3] && match[4]) {
        const newCommandShort = match[1];
        const newCommandName = match[2];
        const newCommandDescription = match[3].trim();
        const newCommandAction = match[4].trim();

        if (initialSuggestions.internal.includes(newCommandName.toLowerCase())) {
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Cannot redefine built-in command "${newCommandName}".`, type: 'error', category: 'internal' }];
        } else {
            // Note: Calling these client-side functions from a server action is problematic.
            try {
                 addSuggestion('internal', newCommandName);
                 addCustomCommand(newCommandName, newCommandAction);
            } catch (e) {
                console.warn("addSuggestion/addCustomCommand called in server context, may not behave as expected.", e)
            }

            // Create log entry in the new format
            const logText = `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Desc: "${newCommandDescription}". Action: "${newCommandAction}".`;
            const logEntry: LogEntry = {
                timestamp: new Date().toISOString(),
                type: 'I', // Info type
                text: logText,
            };

            // Update the log entries array directly
            updatedLogEntries.push(logEntry);

            // Provide feedback (same text as log entry for consistency)
            outputLines.push({ id: `out-${timestamp}`, text: logText, type: 'info', category: 'internal' });
        }
    } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add_int_cmd <short> <name> "<description>" <whatToDo>`, type: 'error', category: 'internal' }];
    }

    // Return output and the potentially updated log entries
    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries.length > currentLogEntries.length ? updatedLogEntries : undefined
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
