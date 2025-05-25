/src/lib/permissions.ts
// src/lib/permissions.ts
'use server';

import { runSql } from './database';

/**
 * Fetches the list of permission names for a given user ID.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of permission names (strings),
 *          or an object with error details if fetching fails or DB is not initialized.
 * @throws Throws an error if the database query fails for reasons other than missing tables.
 */
export async function getUserPermissions(userId: number): Promise<string[] | { error: string, code: 'DB_NOT_INITIALIZED' | 'OTHER_ERROR' }> {
    // Ensure userId is a valid number
    if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
        console.warn(`Attempted to get permissions for invalid userId: ${userId}`);
        // Return an error object instead of an empty array for invalid input
        return { error: `Invalid user ID provided: ${userId}`, code: 'OTHER_ERROR' };
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
        return []; // Return empty array if no permissions found
    } catch (error) {
        console.error(`Error retrieving permissions for user ID ${userId}:`, error);
         if (error instanceof Error && (error.message.includes('no such table: permissions') || error.message.includes('no such table: user_roles') || error.message.includes('no such table: role_permissions'))) {
            // Specific error for non-existent RBAC tables
            return { error: 'Database RBAC tables not initialized.', code: 'DB_NOT_INITIALIZED' };
        }
        // General error for other DB issues
        return { error: `Failed to retrieve user permissions: ${error instanceof Error ? error.message : 'Unknown DB error'}`, code: 'OTHER_ERROR' };
        // Alternatively, re-throw for critical errors: throw error;
    }
}
