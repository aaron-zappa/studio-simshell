// src/lib/internal-commands/handle-help.ts
'use server';
// src/lib/internal-commands/handle-help.ts
import type { OutputLine } from '@/components/output-display';
import { ALL_COMMAND_MODES, type CommandMode } from '@/types/command-types';
import type { LogEntry } from '@/types/log-types';
import { internalCommandDefinitions, type CommandDefinition } from '@/lib/internal-commands-definitions';
import { isDatabaseInitialized } from '@/lib/database';
import type { HandlerResult } from './index';

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    args: string[]; // Added args
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

export const handleHelp = async ({ userId, args, timestamp, initialSuggestions, currentLogEntries, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    let helpText = '';
    let outputLines: OutputLine[] = [];
    let logTextEntry = '';
    let logType: 'I' | 'E' = 'I';
    let logFlag: 0 | 1 = 0;

    const requestedCategory = args[0] as CommandMode | undefined;

    const dbInitialized = await isDatabaseInitialized();

    if (requestedCategory) {
        if (!ALL_COMMAND_MODES.includes(requestedCategory)) {
            helpText = `Error: Unknown command category '${requestedCategory}'. Available categories: ${ALL_COMMAND_MODES.join(', ')}.`;
            logTextEntry = `Help requested for invalid category: ${requestedCategory}. (User: ${userId})`;
            logType = 'E';
            logFlag = 1;
        } else {
            helpText = `--- Help for Category: ${requestedCategory.toUpperCase()} ---`;
            logTextEntry = `Displayed help for category: ${requestedCategory}. `;

            if (requestedCategory === 'internal') {
                let commandsToShow: CommandDefinition[] = internalCommandDefinitions;
                if (!dbInitialized && !overridePermissionChecks) {
                    commandsToShow = internalCommandDefinitions.filter(cmdDef => cmdDef.name === 'ai' || cmdDef.name === 'init_db' || cmdDef.name === 'help');
                    logTextEntry += '(Database not initialized - showing limited internal commands). ';
                    helpText += "\n\n**Note:** Database not fully initialized. Some internal commands may be unavailable. Run 'init_db'.";
                }

                commandsToShow.forEach(cmdDef => {
                    if (overridePermissionChecks || !cmdDef.requiredPermission || userPermissions.includes(cmdDef.requiredPermission) || userPermissions.includes('override_all_permissions')) {
                        helpText += `\n\n**${cmdDef.name}**`;
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
            } else {
                const suggestions = initialSuggestions[requestedCategory];
                if (suggestions && suggestions.length > 0) {
                    suggestions.forEach(suggestion => {
                        let showSuggestion = true;
                        if (!overridePermissionChecks && !userPermissions.includes('override_all_permissions')) {
                            if (requestedCategory === 'sql' && !(userPermissions.includes('execute_sql_select') || userPermissions.includes('execute_sql_modify'))) {
                                showSuggestion = false;
                            }
                            if (requestedCategory === 'python' && !userPermissions.includes('execute_python_code')) {
                                showSuggestion = false;
                            }
                            // Add checks for other categories if specific permissions are relevant
                        }
                        if (showSuggestion) {
                            helpText += `\n- ${suggestion}`;
                        }
                    });
                    if (helpText.split('\n').length === 1) { // Only title was added
                        helpText += `\nNo commands/suggestions available for category '${requestedCategory}' with current permissions, or category is empty.`;
                    }
                } else {
                    helpText += `\nNo commands or suggestions found for category '${requestedCategory}'.`;
                }
            }
        }
    } else {
        // General Help (current behavior)
        helpText = `Command category is automatically detected.\n@bat:<filename><.bat/.sh/.sim>(experimental).\nAvailable categories: ${ALL_COMMAND_MODES.join(', ')}.\nType 'help <category_name>' for category-specific commands.\n\n--- Command Suggestions by Category ---`;
        logTextEntry = 'Displayed general help. ';

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
            if (category === 'internal') continue; // Already handled

            const suggestions = initialSuggestions[category];
            if (suggestions && suggestions.length > 0) {
                let categoryHasVisibleSuggestions = false;
                let categoryHelpText = `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
                suggestions.forEach(suggestion => {
                    let showSuggestion = true;
                     if (!overridePermissionChecks && !userPermissions.includes('override_all_permissions')) {
                        // Example permission checks - adjust as needed for other categories
                        if (category === 'sql' && !(userPermissions.includes('execute_sql_select') || userPermissions.includes('execute_sql_modify'))) {
                            showSuggestion = false;
                        }
                        if (category === 'python' && !userPermissions.includes('execute_python_code')) {
                            showSuggestion = false;
                        }
                        // Add other category permission checks here
                    }
                    if (showSuggestion) {
                        categoryHelpText += `\n- ${suggestion}`;
                        categoryHasVisibleSuggestions = true;
                    }
                });
                if (categoryHasVisibleSuggestions) {
                    helpText += categoryHelpText;
                }
            }
        }
        helpText += `\n\nNote: Variable assignments in 'internal' or 'python' mode use \`var_name = value\`.`;
    }


    outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined, flag: 0 }]; // Ensure help output isn't log-formatted
    logTextEntry += ` (User: ${userId})`;
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
