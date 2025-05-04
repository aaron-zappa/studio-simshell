// src/types/log-types.ts
// src/types/log-types.ts

/**
 * Represents a single log entry with timestamp, type, flag, and text.
 */
export type LogEntry = {
  timestamp: string;
  type: 'I' | 'W' | 'E'; // Info, Warning, Error
  flag: 0 | 1; // Generic flag (0 for normal, 1 for special - meaning TBD by context)
  text: string;
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'log-types.ts';
}