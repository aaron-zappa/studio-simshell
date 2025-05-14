// src/lib/users.ts
// src/lib/users.ts
'use server';

import { runSql } from './database';

interface UserDetails {
  username: string;
  role: string; // For simplicity, we'll fetch the first role found.
}

/**
 * Fetches the username and the first role of a given user ID.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an object with username and role, or null if not found or error.
 */
export async function getUserDetailsById(userId: number): Promise<UserDetails | null> {
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
    console.warn(`Attempted to get details for invalid userId: ${userId}`);
    return null;
  }

  const sql = `
    SELECT
      u.username,
      r.role_name
    FROM users u
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.role_id
    WHERE u.user_id = ?
    LIMIT 1; -- Fetch only one role if multiple exist, for simplicity
  `;

  try {
    const { results } = await runSql(sql, [userId]);
    if (results && results.length > 0) {
      const user = results[0];
      return {
        username: user.username,
        role: user.role_name || 'N/A', // Default role if none found
      };
    }
    return null; // User not found
  } catch (error) {
    console.error(`Error retrieving details for user ID ${userId}:`, error);
    // Check if error is due to missing tables, common before 'init db'
    if (error instanceof Error && (error.message.includes('no such table: users') || error.message.includes('no such table: roles') || error.message.includes('no such table: user_roles'))) {
        console.warn(`User tables not found, cannot fetch user details for ID ${userId}. Run 'init db'.`);
        return null;
    }
    // For other errors, re-throwing might be too disruptive, so log and return null.
    // Depending on requirements, you might want to throw specific errors.
    return null;
  }
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'users.ts';
}
