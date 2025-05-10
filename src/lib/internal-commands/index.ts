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
import { handleSetSimMode } from './handle-set-sim-mode'; // Import new handler for sim_mode
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
    overridePermissionChecks?: boolean; // Optional flag to bypass checks
}

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (uses new LogEntry type)
}


/**
 * Central dispatcher for handling internal commands.
 * Now returns a HandlerResult object.
 * Includes permission checks for relevant commands, can be overridden.
 */
export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<HandlerResult> => {
    const { commandName, commandLower, args, getCustomCommandAction, userPermissions, timestamp, userId, overridePermissionChecks } = params; // Destructure args

    const permissionDenied = (requiredPermission: string): HandlerResult => {
        const errorMsg = `Permission denied: Requires '${requiredPermission}' permission.`;
        return {
            outputLines: [{ id: `perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }],
            // Include flag=0 for permission denied error log
            newLogEntries: [...params.currentLogEntries, { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` }],
        };
    };

    // Experimental @bat command handling
    if (commandName.startsWith('@bat:')) {
        // TODO: Implement actual script execution logic here (with strict permission checks)
        console.warn("Experimental @bat command received, but execution is not yet implemented.");
        return {
            outputLines: [{ id: `bat-warn-${params.timestamp}`, text: `Experimental command @bat: not yet implemented.`, type: 'warning', category: 'internal', timestamp: params.timestamp, flag: 1 }],
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
        case 'add_int_cmd':
             if (commandLower.startsWith('add_int_cmd ')) {
                 if (!overridePermissionChecks && !userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools'); // Assuming same permission for simplicity
                 return handleAddCommand(params); // Handles regular internal commands
             }
             break;
        case 'add_ai_tool':
             if (commandLower.startsWith('add_ai_tool ')) {
                 if (!overridePermissionChecks && !userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools');
                 return handleAddAiTool(params); // Handles defining AI tools
             }
             break;
        case 'set':
             if (commandLower.startsWith('set ai_tool ')) {
                 if (!overridePermissionChecks && !userPermissions.includes('manage_ai_tools')) return permissionDenied('manage_ai_tools');
                 // Pass args starting *after* 'set ai_tool' to the handler
                 return handleSetAiToolActive({ ...params, args: args.slice(2) });
             } else if (commandLower.startsWith('set sim_mode ')) {
                // Assuming 'manage_variables' permission is appropriate, or create a new one
                 if (!overridePermissionChecks && !userPermissions.includes('manage_variables')) return permissionDenied('manage_variables');
                 return handleSetSimMode({ ...params, args: args.slice(2) }); // Pass args after 'set sim_mode'
             }
             break; // Fall through if not a recognized 'set' command
        case 'export':
             if (commandLower === 'export log') {
                 // Export log is client-side, server handler is informational (no specific perm needed here)
                return handleExportLog(params);
             } else if (commandLower === 'export db') {
                 if (!overridePermissionChecks && !userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify'); // Exporting DB might be sensitive
                // Export db triggers persistence with a default name
                return handleExportDb(params);
             }
             break; // Fall through if not 'export log' or 'export db'
        case 'pause':
            // Pause is mostly client-side, server handler is informational
            return handlePause(params);
        case 'create':
            if (commandLower.startsWith('create sqlite')) {
                 // Creating might be admin-level
                 if (!overridePermissionChecks && !userPermissions.includes('manage_users')) return permissionDenied('manage_users'); // Example: Restrict to admin
                 return handleCreateSqlite(params); // Returns HandlerResult
            }
            break; // Fall through if not 'create sqlite'
        case 'show':
            if (commandLower.startsWith('show requirements')) {
                // Generally safe, no specific perm needed
                 return handleShowRequirements(params); // This now returns HandlerResult
            }
            break; // Fall through if not 'show requirements'
        case 'persist':
            if (commandLower.startsWith('persist memory db to ')) {
                 if (!overridePermissionChecks && !userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify'); // Persisting DB might be sensitive
                 return handlePersistDb(params); // Call the new handler
            }
            break; // Fall through if not the exact command
        case 'init':
            if (commandLower === 'init db') {
                 // DB Init is likely an admin task
                 if (!overridePermissionChecks && !userPermissions.includes('manage_roles_permissions')) return permissionDenied('manage_roles_permissions');
                 return handleInitDb(params); // Call the specific handler
            } else if (commandLower === 'init' && args.length === 0) { // Check for 'init' without args
                 // General Init might also be admin
                 if (!overridePermissionChecks && !userPermissions.includes('manage_roles_permissions')) return permissionDenied('manage_roles_permissions');
                 return handleInit(params); // Call the new general init handler
            }
            break; // Fall through if not 'init' or 'init db'
        case 'list':
            if (commandLower === 'list py vars') {
                if (!overridePermissionChecks && !userPermissions.includes('read_variables')) return permissionDenied('read_variables');
                return handleListPyVars(params); // Call the new list vars handler
            }
            break; // Fall through if not the exact command
        case 'ai':
            if (!overridePermissionChecks && !userPermissions.includes('use_ai_tools')) return permissionDenied('use_ai_tools');
            return handleAiCommand(params); // Call the new AI handler
    }

     // Check again for 'export db' specifically in case it wasn't caught by the switch (e.g., due to casing)
     if (commandLower === 'export db') {
          if (!overridePermissionChecks && !userPermissions.includes('execute_sql_modify')) return permissionDenied('execute_sql_modify');
         return handleExportDb(params);
     }


    // 2. Custom internal commands (defined via 'add_int_cmd')
    const customAction = getCustomCommandAction(params.commandName);
    if (customAction !== undefined) {
        // Basic check - maybe custom commands require a general 'execute_custom' perm?
        // if (!overridePermissionChecks && !userPermissions.includes('execute_custom')) return permissionDenied('execute_custom');
        // handleCustomCommand now returns HandlerResult
        return handleCustomCommand(params, customAction);
    }

    // 3. Command not found
    return handleNotFound(params); // This now returns HandlerResult
};

async function executeScriptFile(): Promise<HandlerResult> {
    return {
        outputLines: [], newLogEntries: []
    };
}
/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'index.ts';
}
