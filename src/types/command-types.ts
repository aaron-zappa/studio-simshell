// src/types/command-types.ts
// src/types/command-types.ts
/**
 * Defines the possible modes/categories for the command shell.
 * This is used both for initial suggestions and for the result of AI classification.
 */
export type CommandMode = 'internal' | 'python' | 'unix' | 'windows' | 'sql' | 'excel';

// Array containing all possible command modes
export const ALL_COMMAND_MODES: CommandMode[] = ['internal', 'python', 'unix', 'windows', 'sql', 'excel'];


// Note: The CommandCategory type from the classification flow also includes 'ambiguous' and 'unknown'.
// We are keeping CommandMode simpler for now, representing only the executable categories.
// The UI/executor handles 'ambiguous'/'unknown' before calling executeCommand.

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'command-types.ts';
}
