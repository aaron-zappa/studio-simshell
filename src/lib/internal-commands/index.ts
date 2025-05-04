// src/lib/internal-commands/index.ts
// src/lib/internal-commands/index.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import the new LogEntry type
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
import { handleShowRequirements } from './handle-show-requirements';
import { handlePersistDb } from './handle-persist-db';
import { handleInitDb } from './handle-init-db';
import { handleInit } from './handle-init'; // Import the new init handler
import { handleListPyVars } from './handle-list-py-vars'; // Import the new list vars handler
import { handleCustomCommand } from './handle-custom-command';
import { handleNotFound } from './handle-not-found';

interface InternalCommandHandlerParams {
    command: string;
    commandLower: string;
    commandName: string;
    args: string[];
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void; // Client-side, problematic
    addCustomCommand: (name: string, action: CustomCommandAction) => void; // Client-side, problematic
    getCustomCommandAction: (name: string) => CustomCommandAction | undefined; // Client-side, problematic
    currentLogEntries: LogEntry[]; // Pass current logs (uses new LogEntry type)
    initialSuggestions: Record<string, string[]>;
}

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (uses new LogEntry type)
}


/**
 * Central dispatcher for handling internal commands.
 * Now returns a HandlerResult object.
 */
export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<HandlerResult> => {
    const { commandName, commandLower, args, getCustomCommandAction } = params; // Destructure args

    // 1. Built-in commands (prioritized)
    switch (commandName) {
        case 'help':
            return handleHelp(params);
        case 'clear':
            // Special case handled entirely client-side in handleCommandSubmit
            return { outputLines: [] }; // Return empty result
        case 'mode':
            return handleMode(params);
        case 'history':
            return handleHistory(params);
        case 'define':
            return handleDefine(params);
        case 'refine':
            return handleRefine(params);
        case 'add_int_cmd':
             return handleAddCommand(params); // This now returns HandlerResult
        case 'export': // Check if it's 'export log'
             if (commandLower === 'export log') {
                 // Export is client-side, server handler is informational
                return handleExportLog(params);
             }
             break; // Fall through if not 'export log'
        case 'pause':
            // Pause is mostly client-side, server handler is informational
            return handlePause(params);
        case 'create': // Check if it's 'create sqlite'
            if (commandLower.startsWith('create sqlite')) {
                 return handleCreateSqlite(params); // Returns HandlerResult
            }
            break; // Fall through if not 'create sqlite'
        case 'show': // Check if it's 'show requirements'
            if (commandLower.startsWith('show requirements')) {
                 return handleShowRequirements(params); // This now returns HandlerResult
            }
            break; // Fall through if not 'show requirements'
        case 'persist': // Check if it's 'persist memory db to'
            if (commandLower.startsWith('persist memory db to ')) {
                 return handlePersistDb(params); // Call the new handler
            }
            break; // Fall through if not the exact command
        case 'init': // Check if it's 'init' or 'init db'
            if (commandLower === 'init db') {
                 return handleInitDb(params); // Call the specific handler
            } else if (commandLower === 'init' && args.length === 0) { // Check for 'init' without args
                 return handleInit(params); // Call the new general init handler
            }
            break; // Fall through if not 'init' or 'init db'
        case 'list': // Check if it's 'list py vars'
            if (commandLower === 'list py vars') {
                return handleListPyVars(params); // Call the new list vars handler
            }
            break; // Fall through if not the exact command
    }

    // 2. Custom internal commands
    const customAction = getCustomCommandAction(params.commandName);
    if (customAction !== undefined) {
        // handleCustomCommand now returns HandlerResult
        return handleCustomCommand(params, customAction);
    }

    // 3. Command not found
    return handleNotFound(params); // This now returns HandlerResult
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'index.ts';
}
