// src/lib/internal-commands/handle-help.ts
// src/lib/internal-commands/handle-help.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import { type CommandMode, ALL_COMMAND_MODES } from '@/types/command-types';
import type { LogEntry } from '@/types/log-types';
import { internalCommandDefinitions, type CommandDefinition } from '@/lib/internal-commands-definitions'; // Import new definitions
import { isDatabaseInitialized } from '@/lib/database'; // Assuming this function exists

interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    userId: number;
    userPermissions: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>; // For non-internal categories
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean; // To show all commands if true
}

/**
 * Handles the 'help' command.
 * Displays available categories, internal commands (based on user permissions from params),
 * and usage notes, grouped by category.
 */
export const handleHelp = async ({ userId, timestamp, initialSuggestions, currentLogEntries, userPermissions, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    let helpText = `Command category is automatically detected.\n@bat:<filename><.bat/.sh/.sim>(experimental).\n\n--- Command Suggestions by Category ---`;
    let outputLines: OutputLine[] = [];
    let logText = 'Displayed help. ';
    let logType: 'I' | 'E' = 'I';
    let logFlag: 0 | 1 = 0;

    const dbInitialized = await isDatabaseInitialized();

    let commandsToShow: CommandDefinition[] = internalCommandDefinitions;

    if (!dbInitialized) {
        commandsToShow = internalCommandDefinitions.filter(cmdDef => cmdDef.name === 'ai');
        logText += '(Database not initialized - showing limited help)';
    }

    // Internal Commands
 helpText += `\\n\\n**Internal**`;
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

    // Other Categories (Python, SQL, etc.)
    for (const category of ALL_COMMAND_MODES) {
        if (category === 'internal') continue; // Already handled

        const suggestions = initialSuggestions[category];
        if (suggestions && suggestions.length > 0) {
            helpText += `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
            suggestions.forEach(suggestion => {
                // For non-internal commands, we don't have detailed definitions in internalCommandDefinitions yet.
                // We can add a generic permission check if needed, e.g., execute_python, execute_sql.
                // For now, showing all suggestions for other active categories.
                let showSuggestion = true;
                if (category === 'sql' && !(overridePermissionChecks || userPermissions.includes('execute_sql_select') || userPermissions.includes('execute_sql_modify') || userPermissions.includes('override_all_permissions'))) {
                    showSuggestion = false;
                }
                 if (category === 'python' && !(overridePermissionChecks || userPermissions.includes('execute_python_code') || userPermissions.includes('override_all_permissions'))) { // Assuming a generic python perm
                    showSuggestion = false;
                 }
                // Add similar checks for other categories if specific permissions apply

                if (showSuggestion) {
                    helpText += `\n- ${suggestion}`;
                }
            });
        }
    }

    helpText += `\n\nNote: Variable assignments in 'internal' or 'python' mode use \`var_name = value\`.`;

    outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined, flag: 0 }];

    logText = `Displayed help. (User: ${userId})`;
    logType = 'I';
    logFlag = 0;
    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    return { outputLines: outputLines, newLogEntries };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-help.ts';
}
