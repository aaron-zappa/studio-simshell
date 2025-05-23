// src/lib/internal-commands/handle-help.ts
// src/lib/internal-commands/handle-help.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import { ALL_COMMAND_MODES, type CommandMode } from '@/types/command-types';
import type { LogEntry } from '@/types/log-types';
import { internalCommandDefinitions, type CommandDefinition } from '@/lib/internal-commands-definitions';
import { isDatabaseInitialized } from '@/lib/database';
import type { HandlerResult } from './index';

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

export const handleHelp = async ({ userId, timestamp, initialSuggestions, currentLogEntries, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    let helpText = `Command category is automatically detected.\n@bat:<filename><.bat/.sh/.sim>(experimental).\nAvailable categories: ${Object.keys(initialSuggestions).join(', ')}.\n\n--- Command Suggestions by Category ---`;
    let outputLines: OutputLine[] = [];
    let logTextEntry = 'Displayed help. ';
    let logType: 'I' | 'E' = 'I';
    let logFlag: 0 | 1 = 0;

    const dbInitialized = await isDatabaseInitialized();

    let commandsToShow: CommandDefinition[] = internalCommandDefinitions;

    if (!dbInitialized && !overridePermissionChecks) {
        commandsToShow = internalCommandDefinitions.filter(cmdDef => cmdDef.name === 'ai' || cmdDef.name === 'init_db' || cmdDef.name === 'help');
        logTextEntry += '(Database not initialized - showing limited help)';
        helpText += "\n\n**Note:** Database not fully initialized. Some commands may be unavailable. Run 'init_db'.";
    }


    helpText += `\n\n**Internal**`;
    commandsToShow.forEach(cmdDef => {
        if (overridePermissionChecks || !cmdDef.requiredPermission || userPermissions.includes(cmdDef.requiredPermission) || userPermissions.includes('override_all_permissions')) {
            helpText += `\n- **${cmdDef.name}**`;
            if (cmdDef.argsFormat) {
                helpText += ` ${cmdDef.argsFormat}`;
            }
            helpText += `\n  *Description*: ${cmdDef.description}`;
            if (cmdDef.argsDetails && cmdDef.argsDetails.length > 0) {
                helpText += `\n  *Arguments*:`;
                cmdDef.argsDetails.forEach(arg => {
                    helpText += `\n    - \`${arg.name}\`${arg.optional ? ' (optional)' : ''}: ${arg.description}`;
                });
            }
            if (cmdDef.exampleUsage) {
                helpText += `\n  *Example*: \`${cmdDef.exampleUsage}\``;
            }
        }
    });

    for (const category of ALL_COMMAND_MODES) {
        if (category === 'internal') continue;

        const suggestions = initialSuggestions[category];
        if (suggestions && suggestions.length > 0) {
            helpText += `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
            suggestions.forEach(suggestion => {
                let showSuggestion = true;
                if (!overridePermissionChecks && !userPermissions.includes('override_all_permissions')) {
                    if (category === 'sql' && !(userPermissions.includes('execute_sql_select') || userPermissions.includes('execute_sql_modify'))) {
                        showSuggestion = false;
                    }
                    if (category === 'python' && !userPermissions.includes('execute_python_code')) {
                        showSuggestion = false;
                    }
                }


                if (showSuggestion) {
                    helpText += `\n- ${suggestion}`;
                }
            });
        }
    }

    helpText += `\n\nNote: Variable assignments in 'internal' or 'python' mode use \`var_name = value\`.`;

    outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined, flag: 0 }];

    logTextEntry += `(User: ${userId})`;
    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logTextEntry };
    const newLogEntries = [...currentLogEntries, logEntry];

    return {
        outputLines: outputLines,
        newLogEntries: newLogEntries,
        newSuggestions: undefined,
        newCustomCommands: undefined,
        toastInfo: undefined
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-help.ts';
}
