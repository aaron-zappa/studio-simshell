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
import { handleAddAiTool } from './handle-add-ai-tool'; // Import new handler
import { handleExportLog } from './handle-export-log';
import { handleExportDb } from './handle-export-db'; // Import new handler
import { handlePause } from './handle-pause';
import { handleCreateSqlite } from './handle-create-sqlite';
import { handleShowRequirements } from './handle-show-requirements';
import { handlePersistDb } from './handle-persist-db';
import { handleInitDb } from './handle-init-db';
import { handleInit } from './handle-init'; // Import the new init handler
import { handleListPyVars } from './handle-list-py-vars'; // Import the new list vars handler
import { handleAiCommand } from './handle-ai-command'; // Import the new AI command handler
import { handleSetAiToolActive } from './handle-set-ai-tool-active'; // Import the new set tool active handler
import { handleCustomCommand } from './handle-custom-command';
import { handleNotFound } from './handle-not-found';

interface InternalCommandHandlerParams {
    userId: number; // Add user ID
    userPermissions: string[]; // Add permissions list
    command: string;
    commandLower: string;
    commandName: string;
    args: string[];
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void; // Client-side, problematic
    addCustomCommand: (name: string, action: CustomCommandAction) => void; // Client-side, problematic
    getCustomCommandAction: (name: string) => CustomCommandAction | undefined; // Potentially problematic in Server Action
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
 * Includes permission checks for relevant commands.
 */
export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<HandlerResult> => {
    const { commandName, commandLower, args, getCustomCommandAction, userPermissions, timestamp, userId } = params; // Destructure args

    const permissionDenied = (requiredPermission: string): HandlerResult => {
        const errorMsg = `Permission denied: Requires '${requiredPermission}' permission.`;
        return {
            outputLines: [{ id: `perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp }],
            // Include flag=1 for permission denied error log
            newLogEntries: [...params.currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }],
        };
    };

    // Experimental @bat command handling
    if (commandName.startsWith('@bat:')) {
        // TODO: Implement actual script execution logic here (with strict permission checks)
        console.warn("Experimental @bat command received, but execution is not yet implemented.");
        return {
            outputLines: [{ id: `bat-warn-${params.timestamp}`, text: `Experimental command @bat: not yet implemented.`, type: 'warning', category: 'internal', timestamp: params.timestamp }],
            newLogEntries: [...params.currentLogEntries, { timestamp: params.timestamp, type: 'W', flag: 1, text: `Experimental @bat command not implemented: ${params.command} (User: ${userId})` }]
        };
    }


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
            // No specific permission needed for placeholder history
            return handleHistory(params);
        case 'define':
             // Placeholder - Add permission check if implemented
            return handleDefine(params);
        case 'refine':
             // Placeholder - Add permission check if implemented
            return handleRefine(params);
        case 'add': // Check for 'add int_cmd' or 'add ai_tool'
             if (commandLower.startsWith('add int_cmd ')) {
                 if (!userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools'); // Assuming same permission for simplicity
                 return handleAddCommand(params); // Handles regular internal commands
             } else if (commandLower.startsWith('add ai_tool ')) {
                 if (!userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools');
                 return handleAddAiTool(params); // Handles defining AI tools
             }
             break; // Fall through if not 'add int_cmd' or 'add ai_tool'
        case 'set': // Check for 'set ai_tool active'
             if (commandLower.startsWith('set ai_tool ')) { // Check if args[1] exists before accessing
                 if (!userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools');
                 // Pass args starting *after* 'set ai_tool' to the handler
                 return handleSetAiToolActive({ ...params, args: args.slice(2) });
             }
             break; // Fall through if not the specific 'set' command
        case 'export': // Check if it's 'export log' or 'export db'
             if (commandLower === 'export log') {
                 // Export log is client-side, server handler is informational (no specific perm needed here)
                return handleExportLog(params);
             } else if (commandLower === 'export db') {
                 if (!userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify'); // Exporting DB might be sensitive
                // Export db triggers persistence with a default name
                return handleExportDb(params);
             }
             break; // Fall through if not 'export log' or 'export db'
        case 'pause':
            // Pause is mostly client-side, server handler is informational
            return handlePause(params);
        case 'create': // Check if it's 'create sqlite'
            if (commandLower.startsWith('create sqlite')) {
                 // Creating might be admin-level
                 if (!userPermissions.includes('manage_users')) return permissionDenied('manage_users'); // Example: Restrict to admin
                 return handleCreateSqlite(params); // Returns HandlerResult
            }
            break; // Fall through if not 'create sqlite'
        case 'show': // Check if it's 'show requirements'
            if (commandLower.startsWith('show requirements')) {
                // Generally safe, no specific perm needed
                 return handleShowRequirements(params); // This now returns HandlerResult
            }
            break; // Fall through if not 'show requirements'
        case 'persist': // Check if it's 'persist memory db to'
            if (commandLower.startsWith('persist memory db to ')) {
                 if (!userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify'); // Persisting DB might be sensitive
                 return handlePersistDb(params); // Call the new handler
            }
            break; // Fall through if not the exact command
        case 'init': // Check if it's 'init' or 'init db'
            if (commandLower === 'init db') {
                 // DB Init is likely an admin task
                 if (!userPermissions.includes('manage_roles_permissions')) return permissionDenied('manage_roles_permissions');
                 return handleInitDb(params); // Call the specific handler
            } else if (commandLower === 'init' && args.length === 0) { // Check for 'init' without args
                 // General Init might also be admin
                 if (!userPermissions.includes('manage_roles_permissions')) return permissionDenied('manage_roles_permissions');
                 return handleInit(params); // Call the new general init handler
            }
            break; // Fall through if not 'init' or 'init db'
        case 'list': // Check if it's 'list py vars'
            if (commandLower === 'list py vars') {
                if (!userPermissions.includes('read_variables')) return permissionDenied('read_variables');
                return handleListPyVars(params); // Call the new list vars handler
            }
            break; // Fall through if not the exact command
        case 'ai': // Add case for the new 'ai' command
            if (!userPermissions.includes('use_ai_tools')) return permissionDenied('use_ai_tools');
            return handleAiCommand(params); // Call the new AI handler
    }

     // Check again for 'export db' specifically in case it wasn't caught by the switch (e.g., due to casing)
     if (commandLower === 'export db') {
          if (!userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify');
         return handleExportDb(params);
     }


    // 2. Custom internal commands (defined via 'add int_cmd')
    const customAction = getCustomCommandAction(params.commandName);
    if (customAction !== undefined) {
        // Basic check - maybe custom commands require a general 'execute_custom' perm?
        // if (!userPermissions.includes('execute_custom')) return permissionDenied('execute_custom');
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