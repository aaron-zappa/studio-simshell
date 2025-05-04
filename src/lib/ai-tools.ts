// src/lib/ai-tools.ts
// src/lib/ai-tools.ts
'use server';

import { runSql } from '@/lib/database';

export interface AiToolMetadata {
    name: string;
    description: string;
    args_description: string;
    isactive: number; // 0 or 1
}

/**
 * Fetches metadata for all active AI tools from the database.
 * @returns A promise that resolves to an array of active AI tool metadata objects.
 * @throws Throws an error if the database query fails.
 */
export async function getActiveAiToolsMetadata(): Promise<AiToolMetadata[]> {
    const sql = 'SELECT name, description, args_description, isactive FROM ai_tools WHERE isactive = 1 ORDER BY name;';
    try {
        // runSql ensures DB is initialized
        const { results } = await runSql(sql);
        // Ensure the result matches the expected type structure
        if (results && Array.isArray(results)) {
            // Validate each row structure (optional but good practice)
             return results.map((row: any) => ({
                name: row.name,
                description: row.description,
                args_description: row.args_description,
                isactive: row.isactive
             })) as AiToolMetadata[];
        }
        return []; // Return empty array if no results or invalid format
    } catch (error) {
        console.error("Error retrieving active AI tools metadata:", error);
        // Re-throw or handle as appropriate for your application
        throw new Error(`Failed to retrieve AI tools: ${error instanceof Error ? error.message : 'Unknown DB error'}`);
    }
}


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'ai-tools.ts';
}
