// src/lib/internal-commands/handle-not-found.ts
// src/lib/internal-commands/handle-not-found.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/lib/logging'; // Import LogEntry

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (not applicable here yet)
}

interface HandlerParams {
    commandName: string;
    timestamp: string;
    // Potentially add currentLogEntries if this needs to log
}

// Update function signature to return HandlerResult and make it async
export const handleNotFound = async ({ commandName, timestamp }: HandlerParams): Promise<HandlerResult> => {
    const outputLines = [{ id: `out-${timestamp}`, text: `Internal command not found: ${commandName}`, type: 'error', category: 'internal' }];
    // Return the result object (no log changes)
    return { outputLines: outputLines };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-not-found.ts';
}

