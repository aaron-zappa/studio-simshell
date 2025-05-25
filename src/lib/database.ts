/src/lib/database.ts
// src/lib/database.ts
'use server';

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const DEFAULT_PERSISTENT_DB_FILENAME = 'sim_shell.db'; // Updated default persistent DB

let dbInstance: DB | null = null;
let loadedDbPath: string | null = null;

/**
 * Validates a SQLite filename.
 * Allows alphanumeric, underscores, hyphens, and periods. Must end with .db.
 * Prevents path traversal.
 */
function isValidFilename(filename: string): boolean {
    if (!filename) return false;
    return /^[a-zA-Z0-9_.-]+\.db$/.test(filename) && !filename.includes('/') && !filename.includes('..');
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
 * Creates essential tables if they don't already exist in the database.
 * This is called after a file-based DB connection is established.
 */
async function ensureTablesExist(db: DB): Promise<void> {
    console.log("Ensuring essential tables exist...");
    const coreTableCheckSql = "SELECT name FROM sqlite_master WHERE type='table' AND name='users';";
    let tablesExist = false;
    try {
        const coreTable = db.prepare(coreTableCheckSql).get();
        if (coreTable) {
            tablesExist = true;
            console.log("Core tables appear to exist.");
        }
    } catch (error) {
        // This catch might not be strictly necessary if get() returns undefined for no rows
        console.warn("Could not verify core table existence, assuming tables need creation:", error);
    }

    if (!tablesExist) {
        console.log("Core tables not found. Creating essential tables...");
        const createTableStatements = [
            `CREATE TABLE IF NOT EXISTS variables (
                name VARCHAR(255) NOT NULL PRIMARY KEY,
                datatype VARCHAR(50) NOT NULL,
                value TEXT,
                max REAL,
                min REAL,
                default_value TEXT
            );`,
            `CREATE TABLE IF NOT EXISTS variables2 (
                name VARCHAR(255) NOT NULL PRIMARY KEY,
                datatype VARCHAR(50) NOT NULL,
                value TEXT,
                max REAL,
                min REAL,
                default_value TEXT
            );`,
            `CREATE TABLE IF NOT EXISTS ai_tools (
                name VARCHAR(255) NOT NULL PRIMARY KEY,
                description TEXT NOT NULL,
                args_description TEXT NOT NULL,
                isactive BOOLEAN NOT NULL DEFAULT 1
            );`,
            `CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(100) NOT NULL UNIQUE,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS roles (
                role_id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name VARCHAR(50) NOT NULL UNIQUE
            );`,
            `CREATE TABLE IF NOT EXISTS permissions (
                permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
                permission_name VARCHAR(100) NOT NULL UNIQUE
            );`,
            `CREATE TABLE IF NOT EXISTS user_roles (
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, role_id),
                FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE
            );`,
            `CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions (permission_id) ON DELETE CASCADE
            );`,
            `CREATE TABLE IF NOT EXISTS command_metadata (
                command_name TEXT NOT NULL PRIMARY KEY,
                command_description TEXT,
                result_description TEXT,
                result_type TEXT,
                result_min REAL,
                result_max REAL,
                result_length INTEGER
            );`,
            `CREATE TABLE IF NOT EXISTS command_input_arguments (
                argument_id INTEGER PRIMARY KEY AUTOINCREMENT,
                command_name TEXT NOT NULL,
                argument_name TEXT NOT NULL,
                argument_type TEXT NOT NULL,
                argument_purpose TEXT,
                argument_default_value TEXT,
                argument_min REAL,
                argument_max REAL,
                argument_length INTEGER,
                is_required BOOLEAN DEFAULT 1,
                position INTEGER,
                FOREIGN KEY (command_name) REFERENCES command_metadata (command_name) ON DELETE CASCADE,
                UNIQUE (command_name, argument_name),
                UNIQUE (command_name, position)
            );`
        ];

        try {
            db.transaction(() => {
                for (const sql of createTableStatements) {
                    db.prepare(sql).run();
                }
            })();
            console.log("Successfully created essential tables.");
        } catch (error) {
            console.error("Error creating essential tables:", error);
            throw new Error(`Failed to create essential tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}


/**
 * Gets the singleton SQLite database instance.
 * Prioritizes SIMSHELL_DB_FILE env var, then DEFAULT_PERSISTENT_DB_FILENAME.
 * Creates the DB file if it doesn't exist and ensures tables are present.
 */
function getDb(): DB {
  if (!dbInstance) {
    ensureDataDirectory();
    let dbPathToUse: string;
    let mode: 'file' | 'memory' = 'file'; // Default to file mode

    const envDbFile = process.env.SIMSHELL_DB_FILE;

    if (envDbFile && isValidFilename(envDbFile)) {
        const potentialPath = path.join(dataDir, envDbFile);
        // No fs.existsSync check here as per previous logic, better-sqlite3 creates if not exists.
        dbPathToUse = potentialPath;
        console.log(`Using database from SIMSHELL_DB_FILE: ${dbPathToUse}`);
    } else {
        if (envDbFile) { // Env var was set but invalid
            console.warn(`Invalid filename in SIMSHELL_DB_FILE: "${envDbFile}". Defaulting to ${DEFAULT_PERSISTENT_DB_FILENAME}.`);
        }
        dbPathToUse = path.join(dataDir, DEFAULT_PERSISTENT_DB_FILENAME);
        // console.log(`Using default persistent database: ${dbPathToUse}`); // Logged by getDbStatusAction or ensureTables
    }

    try {
      dbInstance = new Database(dbPathToUse); // This creates the file if it doesn't exist
      dbInstance.pragma('journal_mode = WAL');
      loadedDbPath = dbPathToUse;
      
      // Ensure tables exist for the file-based DB
      ensureTablesExist(dbInstance).catch(err => {
          console.error("Failed to ensure tables exist on DB load, this might lead to issues:", err);
          // Depending on severity, could throw here or try to close/nullify dbInstance
      });
      // Status logged by getDbStatusAction or ensureTablesExist

    } catch (error) {
        console.error(`Failed to initialize SQLite database (file: ${dbPathToUse}):`, error);
        loadedDbPath = null;
        // Fallback to in-memory if file DB fails catastrophically (e.g., disk permissions)
        try {
            console.warn("Falling back to in-memory database due to file DB initialization failure.");
            dbInstance = new Database(':memory:');
            dbInstance.pragma('journal_mode = WAL');
            loadedDbPath = ':memory:';
            // We might want to run ensureTablesExist for in-memory too if it's a fallback
            ensureTablesExist(dbInstance).catch(err => {
                 console.error("Failed to ensure tables for fallback in-memory DB:", err);
            });
        } catch (memError) {
            console.error("Catastrophic failure: Could not initialize file-based or in-memory database.", memError);
            throw memError; // Re-throw critical failure
        }
    }
  }
  return dbInstance;
}


/**
 * Returns the path of the currently loaded database file, or ':memory:' or null.
 */
function getLoadedDbPathInternal(): string | null {
    if (!dbInstance) {
        try {
            getDb(); // Attempt to initialize if not already
        } catch (e) {
            console.error("DB initialization failed while checking loaded path via getLoadedDbPathInternal.");
        }
    }
    return loadedDbPath;
}


export async function runSql(sql: string, params: any[] = []): Promise<{ results: any[] | null, changes: number | null, lastInsertRowid: bigint | number | null }> {
  const db = getDb();
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

export async function persistDbToFile(targetFilename: string): Promise<boolean> {
    const currentDb = getDb();
    if (!isValidFilename(targetFilename)) {
        throw new Error('Invalid target filename. Use only alphanumeric, underscores, hyphens, and periods, ending with .db.');
    }
    ensureDataDirectory();
    const targetPath = path.join(dataDir, targetFilename);
    console.log(`Attempting to persist current DB to: ${targetPath}`);

    try {
        // If current DB is in-memory and we want to persist to targetPath
        // or if current DB is file-based and targetPath is different, use backup.
        // If current DB is file-based and targetPath is the same, this is redundant but harmless.
        await currentDb.backup(targetPath);
        console.log(`Successfully persisted database to ${targetPath}`);
        if (loadedDbPath === ':memory:' || loadedDbPath !== targetPath) {
            // If we just persisted an in-memory DB, or copied to a new file,
            // we might want to switch the active instance to this new file.
            // For now, the active instance remains as it was.
            // To switch:
            // if (dbInstance) dbInstance.close();
            // dbInstance = new Database(targetPath);
            // dbInstance.pragma('journal_mode = WAL');
            // loadedDbPath = targetPath;
            // console.log(`Switched active DB instance to ${targetPath}`);
        }
        return true;
    } catch (error) {
        console.error(`Error persisting database to ${targetPath}:`, error);
        throw new Error(`Failed to persist database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function isDatabaseInitialized(): Promise<boolean> {
    try {
        const db = getDb();
        if (db) {
            // Check against 'users' as it's a fundamental table for RBAC
            const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();
            return !!table;
        }
        return false;
    } catch (error) {
        // This might catch errors if getDb() itself fails before table check
        console.error("Error checking if database is initialized:", error);
        return false;
    }
}

export async function getDbStatusAction(): Promise<string> {
    const path = getLoadedDbPathInternal(); // This will trigger getDb if dbInstance is null
    let dbIsInitialized = false;
    let tableStatus = "unknown";

    if (dbInstance && path !== ':memory:') { // Only check table status for file DBs after instance is confirmed
        try {
            const table = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();
            dbIsInitialized = !!table;
            tableStatus = dbIsInitialized ? "tables ok" : "tables NOT ok (run 'init db')";
        } catch (e) {
             // This might happen if ensureTablesExist failed silently or was interrupted
            tableStatus = `error checking tables (${e instanceof Error ? e.message.substring(0,30) : 'unknown err'})`;
        }
    } else if (dbInstance && path === ':memory:') {
        // For in-memory, we can assume tables are created by ensureTablesExist if it ran.
        // A more robust check would be similar to file DB.
        try {
            const table = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();
            dbIsInitialized = !!table;
            tableStatus = dbIsInitialized ? "tables ok" : "tables NOT ok (run 'init db' if this is unexpected for memory DB)";
        } catch (e) {
            tableStatus = "tables NOT ok for memory DB";
        }
    }


    if (path === ':memory:') {
        return `Database loaded with status ok (in-memory, ${tableStatus})`;
    } else if (path) {
        return `Database loaded with status ok (file: ${path}, ${tableStatus})`;
    } else {
        return "Database status: nok (not initialized or error during load)";
    }
}
