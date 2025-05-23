// src/lib/internal-commands/handle-add-command.ts
// src/lib/internal-commands/handle-add-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import type { CommandMode } from '@/types/command-types';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { HandlerResult } from './index'; // Import HandlerResult from parent index

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    command: string;
    timestamp: string;
    // addSuggestion & addCustomCommand are problematic as they are client-side.
    // These should ideally become part of the HandlerResult if they modify server-side state
    // or if the client needs to be informed to update its state.
    // addSuggestion: (mode: CommandMode, command: string) => void;
    // addCustomCommand: (name: string, action: CustomCommandAction) => void;
    currentLogEntries: LogEntry[];
    initialSuggestions: Record<string, string[]>;
    overridePermissionChecks?: boolean;
}

export const handleAddCommand = async (params: HandlerParams): Promise<HandlerResult> => {
    const { command, timestamp, currentLogEntries, initialSuggestions, userPermissions, userId, overridePermissionChecks } = params;
    let outputLines: OutputLine[] = [];
    let updatedLogEntries = [...currentLogEntries];
    let logType: 'I' | 'E' = 'I';
    let logText = '';
    let outputType: 'info' | 'error' = 'info';
    let outputText = '';
    let logFlag: 0 | 1 = 0;
    
    // These will be part of the HandlerResult
    let newSuggestionsResult: HandlerResult['newSuggestions'] = undefined;
    let newCustomCommandsResult: HandlerResult['newCustomCommands'] = undefined;


    const addCmdRegex = /^add_int_cmd\s+(\S+)\s+(\S+)\s+"([^"]+)"\s+(.+)$/i;
    const match = command.match(addCmdRegex);

    if (match && match[1] && match[2] && match[3] && match[4]) {
        const newCommandShort = match[1];
        const newCommandName = match[2];
        const newCommandDescription = match[3].trim();
        const newCommandAction = match[4].trim();

        if (initialSuggestions.internal.includes(newCommandName.toLowerCase())) {
            outputText = `Error: Cannot redefine built-in command "${newCommandName}".`;
            outputType = 'error';
            logType = 'E';
            logFlag = 1; // Error flag
            logText = `${outputText} (User: ${userId})`;
            outputLines = [{ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }];
        } else {
            // Instead of calling client-side functions, prepare data for HandlerResult
            newSuggestionsResult = [{ mode: 'internal', command: newCommandName }];
            newCustomCommandsResult = [{ name: newCommandName, action: newCommandAction }];
            
            logText = `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Desc: "${newCommandDescription}". Action: "${newCommandAction}". (User: ${userId})`;
            outputText = `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Description: "${newCommandDescription}". Action: "${newCommandAction}". Logged to session log.`;
            outputType = 'info';
            logType = 'I';
            logFlag = 0;
            outputLines.push({ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        }
    } else {
        outputText = `Error: Invalid syntax. Use: add_int_cmd <short> <name> "<description>" <whatToDo>`;
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Error flag
        logText = `${outputText} (User: ${userId}, Command: ${command})`;
        outputLines = [{ id: `out-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag }];
    }

    updatedLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

    return {
        outputLines: outputLines,
        newLogEntries: updatedLogEntries,
        newSuggestions: newSuggestionsResult,
        newCustomCommands: newCustomCommandsResult,
        toastInfo: undefined // No toast from this handler
    };
};
