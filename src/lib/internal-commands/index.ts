// src/lib/internal-commands/index.ts
// src/lib/internal-commands/index.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import type { CommandMode } from '@/types/command-types';
import { internalCommandDefinitions } from '@/lib/internal-commands-definitions'; // Can be used for permission checks

// Import individual command handlers
import { handleHelp } from './handle-help';
import { handleMode } from './handle-mode';
import { handleHistory } from './handle-history';
import { handleDefine } from './handle-define';
import { handleRefine } from './handle-refine';
import { handleAddCommand } from './handle-add-command';
import { handleAddAiTool } from './handle-add-ai-tool';
import { handleExportLog } from './handle-export-log';
import { handleExportDb } from './handle-export-db';
import { handlePause } from './handle-pause';
import { handleCreateSqlite } from './handle-create-sqlite';
import { handleShowRequirements } from './handle-show-requirements';
import { handlePersistDb } from './handle-persist-db';
import { handleInitDb } from './handle-init-db';
import { handleInit } from './handle-init';
import { handleListPyVars } from './handle-list-py-vars';
import { handleAiCommand } from './handle-ai-command';
import { handleSetAiToolActive } from './handle-set-ai-tool-active';
import { handleSetSimMode } from './handle-set-sim-mode';
import { handleCustomCommand } from './handle-custom-command';
import { handleNotFound } from './handle-not-found';

interface InternalCommandHandlerParams {
    userId: number;
    userPermissions: string[];
    command: string;
    commandLower: string;
    commandName: string;
    args: string[];
    timestamp: string;
    addSuggestion: (mode: CommandMode, command: string) => void;
    addCustomCommand: (name: string, action: CustomCommandAction) => void;
    getCustomCommandAction: (name: string) => CustomCommandAction | undefined;
    currentLogEntries: LogEntry[];
    initialSuggestions: Record<string, string[]>;
    overridePermissionChecks?: boolean;
}

interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
    toastInfo?: { message: string; variant?: 'default' | 'destructive' };
}


/**
 * Central dispatcher for handling internal commands.
 * Now returns a HandlerResult object.
 * Includes permission checks for relevant commands, can be overridden.
 */
export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<HandlerResult> => {
    const { commandName, commandLower, args, getCustomCommandAction, userPermissions, timestamp, userId, overridePermissionChecks } = params;

    // Find command definition for permission check
    const commandDef = internalCommandDefinitions.find(def => def.name === commandName);

    const permissionDenied = (requiredPermission: string): HandlerResult => {
        const errorMsg = `Permission denied: Requires '${requiredPermission}' permission.`;
        return {
            outputLines: [{ id: `perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }],
            newLogEntries: [...params.currentLogEntries, { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` }],
            toastInfo: undefined
        };
    };

    // Centralized permission check using commandDef (except for help which is always allowed)
    if (commandName !== 'help' && commandDef && commandDef.requiredPermission && !overridePermissionChecks && !userPermissions.includes(commandDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
        return permissionDenied(commandDef.requiredPermission);
    }
    
    // Experimental @bat command handling
    if (commandName.startsWith('@bat:')) {
        // TODO: Implement actual script execution logic here (with strict permission checks)
        console.warn("Experimental @bat command received, but execution is not yet implemented.");
        return {
            outputLines: [{ id: `bat-warn-${params.timestamp}`, text: `Experimental command @bat: not yet implemented.`, type: 'warning', category: 'internal', timestamp: params.timestamp, flag: 1 }],
            newLogEntries: [...params.currentLogEntries, { timestamp: params.timestamp, type: 'W', flag: 1, text: `Experimental @bat command not implemented: ${params.command} (User: ${userId})` }],
            toastInfo: undefined
        };
    }


    // Dispatch to specific handlers
    switch (commandName) {
        case 'help':
            return handleHelp(params); // Help has its own internal permission filtering for display
        case 'clear':
            return { outputLines: [], toastInfo: undefined };
        case 'mode':
            return handleMode(params);
        case 'history':
            // `commandDef` check above handles permission for 'history' if defined
            return handleHistory(params);
        case 'define':
            return handleDefine(params);
        case 'refine':
            return handleRefine(params);
        case 'add_int_cmd':
             if (commandLower.startsWith('add_int_cmd ')) { // Ensure it's the full command
                 // Permission already checked if commandDef for 'add_int_cmd' has requiredPermission
                 return handleAddCommand(params);
             }
             break;
        case 'add_ai_tool':
             if (commandLower.startsWith('add_ai_tool ')) {
                 return handleAddAiTool(params);
             }
             break;
        case 'set':
             if (commandLower.startsWith('set ai_tool ')) {
                 // Find 'set_ai_tool' in definitions for permission or define it as a sub-command
                 const setAiToolDef = internalCommandDefinitions.find(d => d.name === 'set_ai_tool');
                 if (setAiToolDef?.requiredPermission && !overridePermissionChecks && !userPermissions.includes(setAiToolDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
                     return permissionDenied(setAiToolDef.requiredPermission);
                 }
                 return handleSetAiToolActive({ ...params, args: args.slice(2) });
             } else if (commandLower.startsWith('set sim_mode ')) {
                 const setSimModeDef = internalCommandDefinitions.find(d => d.name === 'set_sim_mode');
                 if (setSimModeDef?.requiredPermission && !overridePermissionChecks && !userPermissions.includes(setSimModeDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
                    return permissionDenied(setSimModeDef.requiredPermission);
                 }
                 return handleSetSimMode({ ...params, args: args.slice(2) });
             }
             break;
        case 'export':
             if (commandLower === 'export log') {
                return handleExportLog(params);
             } else if (commandLower === 'export db') {
                 const exportDbDef = internalCommandDefinitions.find(d => d.name === 'export_db');
                 if (exportDbDef?.requiredPermission && !overridePermissionChecks && !userPermissions.includes(exportDbDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
                    return permissionDenied(exportDbDef.requiredPermission);
                 }
                return handleExportDb(params);
             }
             break;
        case 'pause':
            return handlePause(params);
        case 'create_sqlite': // Changed from 'create'
            // Permission handled by commandDef check at the start if 'create_sqlite' is defined
            return handleCreateSqlite(params);
        case 'show_requirements': // Changed from 'show'
            return handleShowRequirements(params);
        case 'persist_memory_db_to': // Changed from 'persist'
            return handlePersistDb(params);
        case 'init':
            // Special handling for 'init' vs 'init db'
            if (commandLower === 'init db') {
                 const initDbDef = internalCommandDefinitions.find(d => d.name === 'init_db');
                 if (initDbDef?.requiredPermission && !overridePermissionChecks && !userPermissions.includes(initDbDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
                    return permissionDenied(initDbDef.requiredPermission);
                 }
                 return handleInitDb(params);
            } else if (commandLower === 'init' && args.length === 0) {
                 const initDef = internalCommandDefinitions.find(d => d.name === 'init');
                 if (initDef?.requiredPermission && !overridePermissionChecks && !userPermissions.includes(initDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
                    return permissionDenied(initDef.requiredPermission);
                 }
                 return handleInit(params);
            }
            break;
        case 'list_py_vars': // Changed from 'list'
            return handleListPyVars(params);
        case 'ai':
            return handleAiCommand(params);
    }

    const customAction = getCustomCommandAction(params.commandName);
    if (customAction !== undefined) {
        // For custom commands, we might need a generic 'execute_custom_command' permission
        // Or, their definition (if stored) could include specific permissions.
        // For now, assuming custom commands bypass the commandDef check above or are caught by it if named like a base command.
        return handleCustomCommand(params, customAction);
    }

    return handleNotFound(params);
};

async function executeScriptFile(): Promise<HandlerResult> {
    return {
        outputLines: [], newLogEntries: [], toastInfo: undefined
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
