// src/lib/database.ts
// src/lib/database.ts
'use server';

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import * as fs from 'fs'; // Import fs for file system operations
import * as path from 'path'; // Import path for secure path joining

// Module-level variable to hold the database instance and loaded path.
let dbInstance: DB | null = null;
let loadedDbPath: string | null = null; // Store the path if loaded from file
const dataDir = path.join(process.cwd(), 'data'); // Define data directory path

/**
 * Validates a SQLite filename.
 * Allows alphanumeric, underscores, hyphens, and periods. Must end with .db.
 * Prevents path traversal.
 * @param filename - The filename to validate.
 * @returns True if valid, false otherwise.
 */
function isValidFilename(filename: string): boolean {
    return /^[a-zA-Z0-9_\-\.]+\.db$/.test(filename) && !filename.includes('/') && !filename.includes('..');
}

/**
 * Ensures the data directory exists.
 */
function ensureDataDirectory(): void {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`Created data directory: ${dataDir}`);
        }
    } catch (error) {
        console.error(`Error creating data directory '${dataDir}':`, error);
        throw new Error(`Failed to ensure data directory exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Gets the singleton SQLite database instance.
 * If SIMUSHELL_DB_FILE env var is set and the file exists in ./data, it loads from the file.
 * Otherwise, it creates/uses an in-memory database.
 * @returns The better-sqlite3 Database instance.
 */
function getDb(): DB {
  if (!dbInstance) {
    ensureDataDirectory(); // Ensure ./data exists
    const dbFilename = process.env.SIMUSHELL_DB_FILE;
    let dbPath: string | null = null;
    let mode: 'file' | 'memory' = 'memory';

    if (dbFilename && isValidFilename(dbFilename)) {
        const potentialPath = path.join(dataDir, dbFilename);
        if (fs.existsSync(potentialPath)) {
            console.log(`Attempting to load database from file: ${potentialPath}`);
            dbPath = potentialPath;
            mode = 'file';
        } else {
            console.warn(`Database file specified by SIMUSHELL_DB_FILE (${potentialPath}) not found. Falling back to in-memory database.`);
            dbPath = null; // Reset to null to force in-memory
        }
    } else if (dbFilename) {
         console.warn(`Invalid filename specified in SIMUSHELL_DB_FILE: "${dbFilename}". Falling back to in-memory database.`);
    }

    try {
      // Use the file path if mode is 'file', otherwise ':memory:'
      const connectionString = mode === 'file' && dbPath ? dbPath : ':memory:';
      dbInstance = new Database(connectionString);
      // Enable WAL mode for potentially better performance
      dbInstance.pragma('journal_mode = WAL');

      if (mode === 'file' && dbPath) {
          loadedDbPath = dbPath; // Store the path if loaded from file
          console.log(`Successfully loaded database from file: ${loadedDbPath}`);
      } else {
          loadedDbPath = ':memory:';
          console.log(`SQLite database initialized (in-memory).`);
      }


      // Optional: Add a cleanup hook for graceful shutdown if needed
      // process.on('exit', () => dbInstance?.close());

    } catch (error) {
        console.error(`Failed to initialize SQLite database (${mode === 'file' ? `file: ${dbPath}` : 'in-memory'}):`, error);
        loadedDbPath = null; // Ensure path is null on failure
        // If initialization fails, subsequent calls might also fail.
        throw error; // Re-throw to indicate failure
    }
  }
  return dbInstance;
}


/**
 * Returns the path of the currently loaded database file, or ':memory:' or null.
 * This function is NOT exported as a Server Action itself but can be called by one.
 * @returns The loaded database path string or null.
 */
function getLoadedDbPathInternal(): string | null {
    // Ensure the DB is initialized if it hasn't been yet
    if (!dbInstance) {
        try {
            getDb();
        } catch (e) {
            // If getDb fails, loadedDbPath should be null
            console.error("DB initialization failed while checking loaded path.");
        }
    }
    return loadedDbPath;
}


/**
 * Executes a SQL query against the database.
 * Marked async as it's used within Server Actions, although better-sqlite3 is synchronous.
 * @param sql The SQL query string to execute.
 * @param params Optional parameters for the SQL query.
 * @returns An object containing the results (for SELECT) or changes info (for others).
 * @throws Throws an error if the SQL execution fails.
 */
export async function runSql(sql: string, params: any[] = []): Promise<{ results: any[] | null, changes: number | null, lastInsertRowid: bigint | number | null }> {
  const db = getDb(); // Ensure DB is initialized (loads from file or memory)
  try {
    const stmt = db.prepare(sql);

    if (stmt.reader) {
        const results = stmt.all(params);
        return { results, changes: null, lastInsertRowid: null };
    } else {
        const info = stmt.run(params);
        const lastInsertRowid = typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid;
        return { results: null, changes: info.changes, lastInsertRowid: lastInsertRowid };
    }
  } catch (error) {
    console.error(`Error executing SQL: ${sql}`, error);
    if (error instanceof Error) {
        if (error.message.includes('syntax error')) {
            throw new Error(`SQL Syntax Error near '${sql.substring(0, 50)}...'`);
        }
        throw new Error(`SQL Error: ${error.message}`);
    }
    throw new Error('An unknown SQL error occurred.');
  }
}

/**
 * Persists the current database (in-memory or file-based) to a target file.
 * If the current DB is file-based, it effectively copies/overwrites the target.
 * WARNING: Allows writing to the server's file system. Use with caution.
 * @param targetFilename The desired filename (e.g., 'mybackup.db'). Basic validation is performed.
 * @returns A boolean indicating success or failure.
 * @throws Throws an error if the operation fails or the DB isn't initialized.
 */
export async function persistDbToFile(targetFilename: string): Promise<boolean> {
    const currentDb = getDb(); // Get the current DB instance (could be memory or file)
    // No need to check if null, getDb always returns an instance or throws

    // Validate target filename
    if (!isValidFilename(targetFilename)) {
        throw new Error('Invalid target filename. Use only alphanumeric, underscores, hyphens, and periods, ending with .db.');
    }

    ensureDataDirectory(); // Ensure ./data exists

    const targetPath = path.join(dataDir, targetFilename);
    console.log(`Attempting to persist current DB to: ${targetPath}`);

    try {
        // Use the backup API to write the current DB state to the target file
        await currentDb.backup(targetPath);
        console.log(`Successfully persisted database to ${targetPath}`);
        return true;
    } catch (error) {
        console.error(`Error persisting database to ${targetPath}:`, error);
        throw new Error(`Failed to persist database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// --- Server Action to get DB status ---
/**
 * Server Action to get the status of the loaded database.
 * @returns A string indicating the loaded database path or if it's in-memory.
 */
export async function getDbStatusAction(): Promise<string> {
    const path = getLoadedDbPathInternal();
    if (path === ':memory:') {
        return "Database is running in-memory.";
    } else if (path) {
        return `Database loaded from file: ${path}`;
    } else {
        return "Database status unknown or not initialized.";
    }
}
// --- End Server Action ---


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'database.ts';
}

