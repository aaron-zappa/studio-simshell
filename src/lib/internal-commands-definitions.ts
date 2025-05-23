// src/lib/internal-commands-definitions.ts
// src/lib/internal-commands-definitions.ts
/**
 * @fileOverview Centralized definitions for all internal SimShell commands.
 * This file provides metadata for each command, including its description,
 * argument format, example usage, and any required permissions.
 */

export interface CommandDefinition {
  name: string; // The command keyword, e.g., "help", "add_int_cmd"
  description: string; // What the command does.
  argsFormat?: string; // A concise representation of arguments, e.g., "<name> <description> <action>"
  argsDetails?: { name: string; description: string; optional?: boolean }[]; // Detailed argument breakdown
  exampleUsage?: string; // A concrete example of how to use the command.
  requiredPermission?: string; // Optional permission needed to see/use this command in help.
}

export const internalCommandDefinitions: CommandDefinition[] = [
  {
    name: 'help',
    description: 'Displays this help message, listing available command categories and commands. Filters command visibility based on user permissions.',
  },
  {
    name: 'clear',
    description: 'Clears the command output history from the display.',
  },
  {
    name: 'history',
    description: 'Placeholder command. Intended to show command history (currently only shows in output area).',
    requiredPermission: 'view_history',
  },
  {
    name: 'define',
    description: 'Placeholder command. Intended for defining or describing terms or concepts.',
    argsFormat: '<term_to_define>',
    argsDetails: [
      { name: 'term_to_define', description: 'The term or concept you want a definition for.' },
    ],
    requiredPermission: 'use_ai_tools',
  },
  {
    name: 'refine',
    description: 'Placeholder command. Intended for refining or elaborating on a previous topic or AI response.',
    argsFormat: '<text_to_refine>',
    argsDetails: [
      { name: 'text_to_refine', description: 'The text or concept to refine.' },
    ],
    requiredPermission: 'use_ai_tools',
  },
  {
    name: 'add_int_cmd',
    description: 'Adds a new custom internal command to the current session. The command can then be executed by its name.',
    argsFormat: '<short_alias> <command_name> "<description>" "<action_to_perform>"',
    argsDetails: [
      { name: 'short_alias', description: 'A short alias or code for the command (currently informational).' },
      { name: 'command_name', description: 'The name used to invoke the custom command.' },
      { name: 'description', description: 'A brief description of what the custom command does (must be in quotes).' },
      { name: 'action_to_perform', description: 'The text that will be output when the command is run (must be in quotes).' },
    ],
    exampleUsage: 'add_int_cmd mycmd greet "Greets the user" "Hello from my custom command!"',
    requiredPermission: 'manage_ai_tools', // Example permission
  },
  {
    name: 'add_ai_tool',
    description: 'Defines a new AI tool that the AI model can potentially use. Stores tool metadata in the database.',
    argsFormat: '<tool_name> "<args_description>" "<tool_description>"',
    argsDetails: [
      { name: 'tool_name', description: 'The unique name for the AI tool (e.g., "getStockPrice").' },
      { name: 'args_description', description: 'A description of the arguments the tool expects, enclosed in quotes (e.g., "ticker:string - The stock ticker symbol").' },
      { name: 'tool_description', description: 'A detailed description of what the tool does, enclosed in quotes.' },
    ],
    exampleUsage: 'add_ai_tool getWeather "<location:string>" "Fetches the current weather for a given location."',
    requiredPermission: 'manage_ai_tools',
  },
  {
    name: 'add_role',
    description: 'Adds a new role to the system roles table.',
    argsFormat: '<role_name>',
    argsDetails: [
      { name: 'role_name', description: 'The unique name for the new role (e.g., "editor", "viewer").' },
    ],
    exampleUsage: 'add role editor',
    requiredPermission: 'manage_roles_permissions',
  },
  {
    name: 'set_ai_tool', // This is the base command name for setting AI tool properties
    description: 'Sets properties for an existing AI tool, such as its active status.',
    argsFormat: '<tool_name> active <0|1>',
    argsDetails: [
      { name: 'tool_name', description: 'The name of the AI tool to modify.' },
      { name: 'active', description: 'Keyword indicating the "isactive" property is being set.' },
      { name: '0|1', description: 'Set to 1 to activate the tool, 0 to deactivate it.' },
    ],
    exampleUsage: 'set_ai_tool getWeather active 1',
    requiredPermission: 'manage_ai_tools',
  },
  {
    name: 'set_sim_mode',
    description: 'Sets the internal simulation mode variable. This variable can be used by other commands or AI logic to alter behavior.',
    argsFormat: '<0|1>',
    argsDetails: [
      { name: '0|1', description: 'Set to 1 to enable a specific simulation mode, 0 to disable it. The meaning of the mode is context-dependent.' },
    ],
    exampleUsage: 'set_sim_mode 1',
    requiredPermission: 'manage_variables',
  },
  {
    name: 'export_log',
    description: 'Triggers a client-side download of the current session log as a CSV file.',
  },
  {
    name: 'export_db',
    description: 'Persists the current database to the default file "sim_shell.db" in the server\'s data directory.',
    requiredPermission: 'execute_sql_modify',
    exampleUsage: 'export db',
  },
  {
    name: 'pause',
    description: 'Client-side command. Signals the UI to attempt to stop any ongoing command execution. Server acknowledges the command.',
  },
  {
    name: 'init',
    description: 'Initializes the system. Creates the "variables" table in the database if it doesn\'t exist and sets some default Python variables (max_iterations, learning_rate, model_name, is_training_enabled). Also creates a placeholder for the "clipboard" variable.',
    requiredPermission: 'manage_roles_permissions',
  },
  {
    name: 'init_db',
    description: 'Initializes the database with essential tables (variables, ai_tools, users, roles, permissions, user_roles, role_permissions, command_metadata, command_input_arguments) and populates them with sample RBAC data. This is a critical setup command.',
    requiredPermission: 'manage_roles_permissions',
  },
  {
    name: 'list_py_vars',
    description: 'Lists all variables currently stored in the "variables" table of the internal database, along with their data types and values.',
    requiredPermission: 'read_variables',
  },
  {
    name: 'show_requirements',
    description: 'Displays the structure of log entries (timestamp, type, flag, text) in CSV format, as defined in "src/types/log-types.ts".',
  },
  {
    name: 'persist_memory_db_to',
    description: 'Persists the current in-memory database to a specified file on the server, within the "data" directory. If no filename is provided, it defaults to "sim_shell.db".',
    argsFormat: '[filename.db]',
    argsDetails: [
        { name: 'filename.db', description: 'Optional. The name of the file (e.g., "my_backup.db") to save the database to. Must end with .db. Defaults to "sim_shell.db" if not provided.', optional: true },
    ],
    exampleUsage: 'persist memory db to backup.db',
    requiredPermission: 'execute_sql_modify',
  },
  {
    name: 'ai',
    description: 'Sends the input text to an AI model for processing. The AI\'s response is stored in the "ai_answer" variable, which can be used in subsequent commands (e.g., `ai Tell me more about {ai_answer}`). Supports variable substitution using {varname} and can be instructed to use defined AI tools via @toolname.',
    argsFormat: '<input_text_with_optional_{varname}_and_@toolname>',
    argsDetails: [
        { name: 'input_text...', description: 'The text prompt for the AI. Can include {variable_name} for substitution and @tool_name to suggest tool usage.' },
    ],
    exampleUsage: 'ai What is the capital of France? (then) ai Tell me more about {ai_answer}. (or) ai @getWeather for London',
    requiredPermission: 'use_ai_tools',
  },
];

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'internal-commands-definitions.ts';
}
