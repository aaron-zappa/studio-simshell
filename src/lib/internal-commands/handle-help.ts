// src/lib/internal-commands/handle-help.ts
// src/lib/internal-commands/handle-help.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import { type CommandMode, ALL_COMMAND_MODES } from '@/types/command-types'; // Corrected import
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry
import { getUserPermissions } from '@/lib/permissions'; // To check permissions for showing commands

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses new LogEntry type
}


interface HandlerParams {
    userId: number;
    userPermissions: string[]; // These are the permissions passed from command-executor
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[];
}

// Map permissions to the commands they enable (adjust as needed)
// This map is used to filter which commands are shown in help based on user's permissions.
const commandPermissions: Record<string, string> = {
    'add_int_cmd': 'manage_ai_tools',
    'add_ai_tool': 'manage_ai_tools',
    'set_ai_tool': 'manage_ai_tools',
    'set_sim_mode': 'manage_variables', // Example permission
    'export_db': 'execute_sql_modify',
    'create_sqlite': 'manage_users',
    'persist_memory_db_to': 'execute_sql_modify',
    'init_db': 'manage_roles_permissions',
    'init': 'manage_roles_permissions',
    'list_py_vars': 'read_variables',
    'ai': 'use_ai_tools',
    // Commands without specific permissions here will always be shown if 'internal'
};

/**
 * Handles the 'help' command.
 * Displays available categories, internal commands (based on user permissions from params),
 * and usage notes, grouped by category.
 */
export const handleHelp = async ({ userId, timestamp, initialSuggestions, currentLogEntries, userPermissions: passedUserPermissions }: HandlerParams): Promise<HandlerResult> => {
    let helpText = '';
    let outputLines: OutputLine[] = [];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let logFlag: 0 | 1 = 0;

    // Use the permissions passed from command-executor.
    // If permissions couldn't be fetched there (e.g., DB_NOT_INITIALIZED was already handled by command-executor),
    // passedUserPermissions might be an empty array or a specific error indicator if command-executor passed one.
    // For simplicity, this help handler now trusts the passedUserPermissions.

    // If DB wasn't initialized, command-executor might have already added an error to output.
    // This help function will proceed to build help text based on available info.
    // It's up to command-executor to decide if it should even call handleHelp if essential parts (like permissions) are missing.

    helpText = `Command category is automatically detected.
@bat:<filename><.bat/.sh/.sim>(experimental).

Available categories: ${ALL_COMMAND_MODES.join(', ')}.
Use checkboxes to select active categories.

--- Command Suggestions by Category ---`;

    for (const category of ALL_COMMAND_MODES) {
        const suggestions = initialSuggestions[category];
        if (suggestions && suggestions.length > 0) {
            helpText += `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
            suggestions.forEach(suggestion => {
                let showSuggestion = true;
                if (category === 'internal') {
                    const baseCommand = suggestion.split(' ')[0].toLowerCase();
                    const requiredPermission = commandPermissions[baseCommand];
                    if (requiredPermission && !passedUserPermissions.includes(requiredPermission) && !passedUserPermissions.includes('override_all_permissions')) {
                        showSuggestion = false;
                    }
                }
                if (showSuggestion) {
                    helpText += `\n- ${suggestion}`;
                }
            });
        }
    }

    helpText += `\n\nRun custom commands by typing their name.
Assign variables using \`var_name = value\`.
Note: 'mode' command is informational only.`;


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
