// src/lib/database.ts
'use server';

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

// Module-level variable to hold the database instance.
// WARNING: This simple approach might have issues with concurrency in high-traffic scenarios
// or specific serverless environments. It's suitable for a single-user demo/simulation.
let dbInstance: DB | null = null;

/**
 * Gets the singleton in-memory SQLite database instance, creating it if it doesn't exist.
 * @returns The better-sqlite3 Database instance.
 */
function getDb(): DB {
  if (!dbInstance) {
    try {
      // Creates an in-memory database
      dbInstance = new Database(':memory:');
      // Enable WAL mode for potentially better performance, though less critical for :memory:
      dbInstance.pragma('journal_mode = WAL');
      console.log('In-memory SQLite database initialized.');

      // Optional: Add a cleanup hook for graceful shutdown if needed, though complex in serverless
      // process.on('exit', () => dbInstance?.close());

    } catch (error) {
        console.error("Failed to initialize in-memory SQLite database:", error);
        // If initialization fails, subsequent calls might also fail.
        // Re-throwing or handling this more gracefully might be needed.
        throw error; // Re-throw to indicate failure
    }
  }
  return dbInstance;
}

/**
 * Executes a SQL query against the in-memory database.
 * Note: better-sqlite3 is synchronous, but marked async to satisfy Next.js build.
 * @param sql The SQL query string to execute.
 * @param params Optional parameters for the SQL query.
 * @returns An object containing the results (for SELECT) or changes info (for others).
 * @throws Throws an error if the SQL execution fails.
 */
export async function runSql(sql: string, params: any[] = []): Promise<{ results: any[] | null, changes: number | null, lastInsertRowid: bigint | number | null }> {
  const db = getDb(); // Ensure DB is initialized
  try {
    // Use prepare for safety against SQL injection, even though input isn't directly user-provided here yet.
    const stmt = db.prepare(sql);

    // Check if it's a SELECT statement (heuristic)
    if (stmt.reader) {
        // .all() executes the statement and returns all rows
        const results = stmt.all(params);
        return { results, changes: null, lastInsertRowid: null };
    } else {
        // .run() executes the statement for INSERT, UPDATE, DELETE, etc.
        const info = stmt.run(params);
        // Ensure lastInsertRowid is consistently number or null for easier handling downstream if needed
        const lastInsertRowid = typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid;
        return { results: null, changes: info.changes, lastInsertRowid: lastInsertRowid };
    }
  } catch (error) {
    console.error(`Error executing SQL: ${sql}`, error);
    // Re-throw the error with potentially more context or as a specific type
    if (error instanceof Error) {
        // Provide a more specific error message for common SQLite errors
        if (error.message.includes('syntax error')) {
            throw new Error(`SQL Syntax Error near '${sql.substring(0, 50)}...'`);
        }
        throw new Error(`SQL Error: ${error.message}`);
    }
    throw new Error('An unknown SQL error occurred.');
  }
}

// formatResultsAsTable moved to src/lib/formatting.ts
