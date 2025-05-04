// src/lib/database.ts
// src/lib/database.ts
'use server';

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import * as fs from 'fs'; // Import fs for file system operations in persistDbToFile
import * as path from 'path'; // Import path for secure path joining

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
 * Returns the current in-memory database instance if it exists, otherwise null.
 * Useful for operations that need the instance but shouldn't initialize it (like persisting).
 * This function is NOT exported.
 * @returns The better-sqlite3 Database instance or null.
 */
function getCurrentDbInstance(): DB | null {
    return dbInstance;
}


/**
 * Executes a SQL query against the in-memory database.
 * Marked async as it's used within Server Actions, although better-sqlite3 is synchronous.
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

/**
 * Persists the current in-memory database to a file.
 * WARNING: This allows writing to the server's file system. Use with caution.
 * @param targetFilename The desired filename (e.g., 'mybackup.db'). Basic validation is performed.
 * @returns A boolean indicating success or failure.
 * @throws Throws an error if the operation fails.
 */
export async function persistDbToFile(targetFilename: string): Promise<boolean> {
    const currentDb = getCurrentDbInstance(); // Use the internal function
    if (!currentDb) {
        throw new Error('In-memory database is not initialized. Cannot persist.');
    }

    // Basic filename validation to prevent path traversal etc.
    // Allow alphanumeric, underscores, hyphens, and periods. Must end with .db
    if (!/^[a-zA-Z0-9_\-\.]+\.db$/.test(targetFilename) || targetFilename.includes('/') || targetFilename.includes('..')) {
        throw new Error('Invalid filename. Use only alphanumeric, underscores, hyphens, and periods, ending with .db.');
    }

    // Define a safe directory to write to (e.g., a 'data' subdirectory)
    // Ensure this directory exists or create it.
    const dataDir = path.join(process.cwd(), 'data'); // Use current working directory + /data
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`Created data directory: ${dataDir}`);
        }
    } catch (error) {
        console.error(`Error creating data directory '${dataDir}':`, error);
        throw new Error(`Failed to ensure data directory exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }


    const targetPath = path.join(dataDir, targetFilename); // Securely join path

    console.log(`Attempting to persist in-memory DB to: ${targetPath}`);

    try {
        // Use the backup API to write the in-memory DB to the file
        // The 'main' argument refers to the source database name (default for the primary DB)
        await currentDb.backup(targetPath);
        console.log(`Successfully persisted database to ${targetPath}`);
        return true;
    } catch (error) {
        console.error(`Error persisting database to ${targetPath}:`, error);
        // Re-throw a more specific error
        throw new Error(`Failed to persist database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'database.ts';
}
