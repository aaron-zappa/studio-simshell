/src/types/command-types.ts
// src/types/command-types.ts
/**
 * Defines the possible modes/categories for the command shell.
 * This is used both for initial suggestions and for the result of AI classification.
 */
export type CommandMode = 'internal' | 'python' | 'unix' | 'windows' | 'sql' | 'excel' | 'typescript';

// Array containing all possible command modes
export const ALL_COMMAND_MODES: CommandMode[] = ['internal', 'python', 'unix', 'windows', 'sql', 'excel', 'typescript'];


// Note: The CommandCategory type from the classification flow also includes 'ambiguous' and 'unknown'.
// We are keeping CommandMode simpler for now, representing only the executable categories.
// The UI/executor handles 'ambiguous'/'unknown' before calling executeCommand.
