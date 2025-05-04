
import type { OutputLine } from '@/components/output-display';
import type { LogEntry, addLogEntry } from '@/lib/logging';
import type { CommandMode } from '@/types/command-types';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';

interface HandlerParams {
    command: string; // Original command string
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void;
    addCustomCommand: (name: string, action: CustomCommandAction) => void;
    setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>;
    initialSuggestions: Record<string, string[]>;
}

export const handleAddCommand = (params: HandlerParams): OutputLine[] => {
    const { command, timestamp, addSuggestion, addCustomCommand, setLogEntries, initialSuggestions } = params;
    let outputLines: OutputLine[] = [];

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
            addSuggestion('internal', newCommandName);
            addCustomCommand(newCommandName, newCommandAction);

            const logEntry: LogEntry = {
                timestamp: new Date().toISOString(),
                short: newCommandShort,
                commandName: newCommandName,
                description: newCommandDescription,
                action: newCommandAction,
            };

            // IMPORTANT: This state update pattern is problematic inside a Server Action.
            // Logging should ideally happen via a separate API route, database call, or dedicated service.
            try {
                 // This relies on the problematic pattern of passing setLogEntries to a server action.
                 // It's kept here for functional parity with the previous version but needs refactoring for production.
                 setLogEntries((prev) => [...prev, logEntry]);
            } catch (logError) {
                 console.error("Logging failed in Server Action context:", logError);
                 outputLines.push({ id: `log-fail-${timestamp}`, text: 'Warning: Command added, but failed to write to session log.', type: 'error', category: 'internal' });
            }

            outputLines.push({ id: `out-${timestamp}`, text: `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Description: "${newCommandDescription}". Action: "${newCommandAction}". Logged to session log.`, type: 'info', category: 'internal' });
        }
    } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add_int_cmd <short> <name> "<description>" <whatToDo>`, type: 'error', category: 'internal' }];
    }
    return outputLines;
};
