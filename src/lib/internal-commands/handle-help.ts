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
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions (though fetched again here for conditional display)
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
    currentLogEntries: LogEntry[]; // Pass current logs
}

// Map permissions to the commands they enable (adjust as needed)
const commandPermissions: Record<string, string> = {
    'add_int_cmd': 'manage_ai_tools', // Assuming same permission
    'add_ai_tool': 'manage_ai_tools',
    'set_ai_tool': 'manage_ai_tools',
    'export_db': 'execute_sql_modify',
    'create_sqlite': 'manage_users', // Example: Admin only
    'persist_memory_db_to': 'execute_sql_modify',
    'init_db': 'manage_roles_permissions',
    'init': 'manage_roles_permissions',
    'list_py_vars': 'read_variables',
    'ai': 'use_ai_tools',
    // Commands without specific permissions: help, clear, mode, history, define, refine, export log, pause, show requirements
};

/**
 * Handles the 'help' command.
 * Displays available categories, internal commands (based on user permissions),
 * and usage notes, grouped by category.
 */
export const handleHelp = async ({ userId, timestamp, initialSuggestions, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    let helpText = '';
    let outputLines: OutputLine[] = [];
    let logText = '';
    let logType: 'I' | 'E' = 'I';
    let logFlag: 0 | 1 = 0;

    // Attempt to fetch permissions to filter the help output
    const permResult = await getUserPermissions(userId);
    let userPermissions: string[] = [];

    if (Array.isArray(permResult)) {
        userPermissions = permResult;
    } else if (permResult.code === 'DB_NOT_INITIALIZED') {
         // If DB not initialized, show a minimal help message
         helpText = `Database not initialized. Please run 'init db' to set up tables and permissions.
Available categories: ${ALL_COMMAND_MODES.join(', ')}.
Use checkboxes to select active categories. Type 'help' for more info after DB initialization.`;
         outputLines.push({ id: `help-init-prompt-${timestamp}`, text: helpText, type: 'info', category: 'internal', timestamp, flag: 0 });
         logText = `Displayed minimal help (DB not initialized). (User: ${userId})`;
         logType = 'I';
         logFlag = 0;
         const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
         return { outputLines, newLogEntries: [...currentLogEntries, logEntry] };
    } else {
         // Handle other permission fetching errors
         helpText = `Error fetching user permissions: ${permResult.error}. Cannot display full help.
Available categories: ${ALL_COMMAND_MODES.join(', ')}.
Use checkboxes to select active categories. Type 'help' for more info.`;
         outputLines.push({ id: `help-perm-error-${timestamp}`, text: helpText, type: 'error', category: 'internal', timestamp, flag: 0 });
         logText = `Error displaying help due to permission fetch error: ${permResult.error}. (User: ${userId})`;
         logType = 'E';
         logFlag = 0;
         const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
         return { outputLines, newLogEntries: [...currentLogEntries, logEntry] };
    }


    helpText = `Command category is automatically detected.
@bat:<filename><.bat/.sh/.sim>(experimental).

Available categories: ${ALL_COMMAND_MODES.join(', ')}.

--- Command Suggestions by Category ---`;

    // Iterate through categories and their suggestions
    // Ensure consistent order of categories in help
    for (const category of ALL_COMMAND_MODES) {
        const suggestions = initialSuggestions[category];
        if (suggestions && suggestions.length > 0) {
            // Add bold category heading
            helpText += `\n\n**${category.charAt(0).toUpperCase() + category.slice(1)}**`;
            // List suggestions under the category, checking permissions for internal commands
            suggestions.forEach(suggestion => {
                let showSuggestion = true;
                if (category === 'internal') {
                    // Extract the base command name (first word)
                    const baseCommand = suggestion.split(' ')[0].toLowerCase();
                    const requiredPermission = commandPermissions[baseCommand];
                    if (requiredPermission && !userPermissions.includes(requiredPermission) && !userPermissions.includes('override_all_permissions')) {
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


    outputLines = [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal', timestamp: undefined, flag: 0 }]; // Add flag

    // Create log entry with flag=0
    logText = `Displayed help. (User: ${userId})`;
    logType = 'I';
    logFlag = 0;
    const logEntry: LogEntry = { timestamp, type: logType, flag: logFlag, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    // Return the result object
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
