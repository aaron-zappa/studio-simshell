// src/lib/internal-commands/handle-persist-db.ts
// src/lib/internal-commands/handle-persist-db.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import { persistDbToFile } from '@/lib/database'; // Import the persistence function
import type { LogEntry } from '@/lib/logging';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (not applicable here)
}

interface HandlerParams {
    args: string[]; // Includes 'memory', 'db', 'to', '<filename.db>'
    timestamp: string;
}

export const handlePersistDb = async ({ args, timestamp }: HandlerParams): Promise<HandlerResult> => {
    // Expected command: persist memory db to <filename.db>
    // args will be ['memory', 'db', 'to', '<filename.db>']
    if (args.length !== 4 || args[0] !== 'memory' || args[1] !== 'db' || args[2] !== 'to') {
        return {
            outputLines: [{ id: `err-${timestamp}`, text: 'Error: Invalid syntax. Use: persist memory db to <filename.db>', type: 'error', category: 'internal' }]
        };
    }

    const targetFilename = args[3];

    try {
        const success = await persistDbToFile(targetFilename);
        if (success) {
            return {
                outputLines: [{ id: `out-${timestamp}`, text: `Successfully persisted in-memory database to file: data/${targetFilename}`, type: 'info', category: 'internal' }]
            };
        } else {
             // This case might not be reachable if persistDbToFile throws on failure, but included for completeness
            return {
                outputLines: [{ id: `err-${timestamp}`, text: 'Failed to persist database for an unknown reason.', type: 'error', category: 'internal' }]
            };
        }
    } catch (error) {
        console.error("Error during database persistence:", error);
        return {
            outputLines: [{ id: `err-${timestamp}`, text: `Error persisting database: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error', category: 'internal' }]
        };
    }
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-persist-db.ts';
}
