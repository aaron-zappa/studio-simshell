
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
 * @param sql The SQL query string to execute.
 * @param params Optional parameters for the SQL query.
 * @returns An object containing the results (for SELECT) or changes info (for others).
 * @throws Throws an error if the SQL execution fails.
 */
export function runSql(sql: string, params: any[] = []): { results: any[] | null, changes: number | null, lastInsertRowid: bigint | null } {
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
        return { results: null, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (error) {
    console.error(`Error executing SQL: ${sql}`, error);
    // Re-throw the error with potentially more context or as a specific type
    if (error instanceof Error) {
        throw new Error(`SQL Error: ${error.message}`);
    }
    throw new Error('An unknown SQL error occurred.');
  }
}

/**
 * Formats database results (array of objects) into a simple text table.
 * @param results Array of result objects from better-sqlite3.
 * @returns A string representing the formatted table, or null if no results.
 */
export function formatResultsAsTable(results: any[]): string | null {
    if (!results || results.length === 0) {
        return "(0 rows)"; // Indicate no results
    }

    const headers = Object.keys(results[0]);
    const columnWidths = headers.map(header => header.length);

    // Calculate max width for each column based on data
    results.forEach(row => {
        headers.forEach((header, index) => {
            const value = row[header];
            const valueLength = value !== null && value !== undefined ? String(value).length : 4; // Length of 'null'
            if (valueLength > columnWidths[index]) {
                columnWidths[index] = valueLength;
            }
        });
    });

    // Create header row
    const headerLine = headers.map((header, index) => header.padEnd(columnWidths[index])).join(' | ');
    const separatorLine = columnWidths.map(width => '-'.repeat(width)).join('-+-'); // Use '+' for intersection

    // Create data rows
    const dataLines = results.map(row => {
        return headers.map((header, index) => {
            const value = row[header];
            const stringValue = value !== null && value !== undefined ? String(value) : 'null';
            return stringValue.padEnd(columnWidths[index]);
        }).join(' | ');
    });

    return [headerLine, separatorLine, ...dataLines, `(${results.length} row${results.length === 1 ? '' : 's'})`].join('\n');
}
