// src/lib/permissions.ts
// src/lib/permissions.ts
'use server';

import { runSql } from './database';

/**
 * Fetches the list of permission names for a given user ID.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of permission names (strings).
 * @throws Throws an error if the database query fails.
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
    // Ensure userId is a valid number
    if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
        console.warn(`Attempted to get permissions for invalid userId: ${userId}`);
        return [];
    }

    // Updated query to use 'permissions' table name
    const sql = `
        SELECT DISTINCT p.permission_name
        FROM permissions p
        JOIN role_permissions rp ON p.permission_id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?;
    `;

    try {
        // runSql ensures DB is initialized
        const { results } = await runSql(sql, [userId]);

        if (results && Array.isArray(results)) {
            return results.map((row: any) => row.permission_name);
        }
        return []; // Return empty array if no permissions found or invalid results format
    } catch (error) {
        console.error(`Error retrieving permissions for user ID ${userId}:`, error);
        // Re-throw or handle as appropriate for your application
        throw new Error(`Failed to retrieve user permissions: ${error instanceof Error ? error.message : 'Unknown DB error'}`);
    }
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'permissions.ts';
}