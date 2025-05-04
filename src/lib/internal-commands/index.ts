// src/lib/internal-commands/index.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/lib/logging';
import type { CommandMode } from '@/types/command-types';

// Import individual command handlers
import { handleHelp } from './handle-help';
import { handleMode } from './handle-mode';
import { handleHistory } from './handle-history';
import { handleDefine } from './handle-define';
import { handleRefine } from './handle-refine';
import { handleAddCommand } from './handle-add-command';
import { handleExportLog } from './handle-export-log';
import { handlePause } from './handle-pause';
import { handleCreateSqlite } from './handle-create-sqlite';
import { handleShowRequirements } from './handle-show-requirements'; // Import new handler
import { handleCustomCommand } from './handle-custom-command';
import { handleNotFound } from './handle-not-found';

interface InternalCommandHandlerParams {
    command: string;
    commandLower: string;
    commandName: string;
    args: string[];
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void;
    addCustomCommand: (name: string, action: CustomCommandAction) => void;
    getCustomCommandAction: (name: string) => CustomCommandAction | undefined;
    logEntries: LogEntry[];
    setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>;
    initialSuggestions: Record<string, string[]>;
}

/**
 * Central dispatcher for handling internal commands.
 */
export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<OutputLine[]> => {
    const { commandName, commandLower, initialSuggestions, getCustomCommandAction, timestamp } = params;

    // 1. Built-in commands (prioritized)
    switch (commandName) {
        case 'help':
            return handleHelp(params);
        case 'clear':
            // Special case handled entirely client-side in handleCommandSubmit
            return [];
        case 'mode':
            return handleMode(params);
        case 'history':
            return handleHistory(params);
        case 'define':
            return handleDefine(params);
        case 'refine':
            return handleRefine(params);
        case 'add_int_cmd':
             return handleAddCommand(params);
        case 'export': // Check if it's 'export log'
             if (commandLower === 'export log') {
                return handleExportLog(params);
             }
             break; // Fall through if not 'export log'
        case 'pause':
            return handlePause(params);
        case 'create': // Check if it's 'create sqlite'
            if (commandLower.startsWith('create sqlite')) {
                return await handleCreateSqlite(params);
            }
            break; // Fall through if not 'create sqlite'
        case 'show': // Check if it's 'show requirements'
            if (commandLower.startsWith('show requirements')) {
                 return await handleShowRequirements(params); // Added await
            }
            break; // Fall through if not 'show requirements'
    }

    // 2. Custom internal commands
    const customAction = getCustomCommandAction(commandName);
    if (customAction !== undefined) {
        return await handleCustomCommand(params, customAction); // Added await
    }

    // 3. Command not found
    return handleNotFound(params);
};
