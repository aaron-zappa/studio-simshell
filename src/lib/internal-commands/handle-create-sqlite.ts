// src/lib/internal-commands/handle-create-sqlite.ts
// src/lib/internal-commands/handle-create-sqlite.ts
'use server';
import type { OutputLine } from '@/components/output-display';
// Note: Database initialization happens implicitly on first SQL query via getDb().

interface HandlerParams {
    args: string[];
    timestamp: string;
}

export const handleCreateSqlite = async ({ args, timestamp }: HandlerParams): Promise<OutputLine[]> => {
    // const filename = args[1]; // Filename is currently ignored
    if (args.length >= 1) { // Check if 'sqlite' keyword is present
        // Simulate a brief action, actual DB init is deferred.
        await new Promise(resolve => setTimeout(resolve, 100));
        return [{ id: `out-${timestamp}`, text: `Internal SQLite in-memory database is ready. Use SQL commands directly.`, type: 'info', category: 'internal' }];
    } else {
        return [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: create sqlite <filename.db> (filename is ignored, uses in-memory DB)`, type: 'error', category: 'internal' }];
    }
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-create-sqlite.ts';
}
