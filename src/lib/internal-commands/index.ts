// src/lib/internal-commands/index.ts
// src/lib/internal-commands/index.ts
'use server';

import type { CustomCommandAction, CustomCommands } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import type { CommandMode } from '@/types/command-types';
import { internalCommandDefinitions } from '@/lib/internal-commands-definitions';

// Import individual command handlers
import { handleHelp } from './handle-help';
// import { handleMode } from './handle-mode'; // Removed
import { handleHistory } from './handle-history';
import { handleDefine } from './handle-define';
import { handleRefine } from './handle-refine';
import { handleAddCommand } from './handle-add-command';
import { handleAddAiTool } from './handle-add-ai-tool';
import { handleExportLog } from './handle-export-log';
import { handleExportDb } from './handle-export-db';
import { handlePause } from './handle-pause';
// import { handleCreateSqlite } from './handle-create-sqlite'; // Removed
import { handleShowRequirements } from './handle-show-requirements';
import { handlePersistDb } from './handle-persist-db';
import { handleInitDb } from './handle-init-db';
import { handleInit } from './handle-init';
import { handleListPyVars } from './handle-list-py-vars';
import { handleAiCommand } from './handle-ai-command';
import { handleSetAiToolActive } from './handle-set-ai-tool-active';
import { handleSetSimMode } from './handle-set-sim-mode';
import { handleAddRole } from './handle-add-role'; // Import new handler
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
    customCommands: CustomCommands;
    currentLogEntries: LogEntry[];
    initialSuggestions: Record<string, string[]>;
    overridePermissionChecks?: boolean;
}

export interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
    newSuggestions?: { mode: CommandMode; command: string }[];
    newCustomCommands?: { name: string; action: CustomCommandAction }[];
    toastInfo?: { message: string; variant?: 'default' | 'destructive' };
}


export const handleInternalCommand = async (params: InternalCommandHandlerParams): Promise<HandlerResult> => {
    const { commandName, commandLower, args, customCommands, userPermissions, timestamp, userId, overridePermissionChecks } = params;

    const commandDef = internalCommandDefinitions.find(def => def.name === commandName);

    const permissionDenied = (requiredPermission: string): HandlerResult => {
        const errorMsg = `Permission denied: Requires '${requiredPermission}' permission.`;
        return {
            outputLines: [{ id: `perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 1 }],
            newLogEntries: [...params.currentLogEntries, { timestamp, type: 'E', flag: 1, text: `${errorMsg} (User: ${userId})` }],
            newSuggestions: undefined,
            newCustomCommands: undefined,
            toastInfo: undefined
        };
    };

    // Centralized permission check for defined internal commands
    if (commandDef && commandDef.requiredPermission && !overridePermissionChecks && !userPermissions.includes(commandDef.requiredPermission) && !userPermissions.includes('override_all_permissions')) {
        // Allow 'help' to bypass this specific check if its definition doesn't require a perm or if it's a special case
        if (commandName !== 'help') {
             return permissionDenied(commandDef.requiredPermission);
        }
    }


    if (commandName.startsWith('@bat:')) {
        console.warn("Experimental @bat command received, but execution is not yet implemented.");
        return {
            outputLines: [{ id: `bat-warn-${params.timestamp}`, text: `Experimental command @bat: not yet implemented.`, type: 'warning', category: 'internal', timestamp: params.timestamp, flag: 1 }],
            newLogEntries: [...params.currentLogEntries, { timestamp: params.timestamp, type: 'W', flag: 1, text: `Experimental @bat command not implemented: ${params.command} (User: ${userId})` }],
            newSuggestions: undefined,
            newCustomCommands: undefined,
            toastInfo: undefined
        };
    }

    switch (commandName) {
        case 'help':
            return handleHelp(params);
        case 'clear':
            return { outputLines: [], newSuggestions: undefined, newCustomCommands: undefined, toastInfo: undefined, newLogEntries: params.currentLogEntries };
        // case 'mode': // Removed
        //     return handleMode(params);
        case 'history':
            return handleHistory(params);
        case 'define':
            return handleDefine(params);
        case 'refine':
            return handleRefine(params);
        case 'add_int_cmd':
             if (commandLower.startsWith('add_int_cmd ')) {
                 return handleAddCommand(params);
             }
             break;
        case 'add_ai_tool':
             if (commandLower.startsWith('add_ai_tool ')) {
                 return handleAddAiTool(params);
             }
             break;
        case 'add_role': // New command case
             if (commandLower.startsWith('add_role ')) {
                 return handleAddRole(params);
             }
             break;
        case 'set':
             if (commandLower.startsWith('set ai_tool ')) {
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
        // case 'create_sqlite': // Removed
        //     return handleCreateSqlite(params);
        case 'show_requirements':
            return handleShowRequirements(params);
        case 'persist_memory_db_to':
            return handlePersistDb(params);
        case 'init':
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
        case 'list_py_vars':
            return handleListPyVars(params);
        case 'ai':
            return handleAiCommand(params);
    }

    const customAction = customCommands[params.commandName.toLowerCase()];
    if (customAction !== undefined) {
        return handleCustomCommand(params, customAction);
    }

    return handleNotFound(params);
};
