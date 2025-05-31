'use server';
// /src/lib/file-actions.ts
// src/lib/file-actions.ts

import * as fs from 'fs/promises';
import * as path from 'path';

const SQL_SCRIPTS_DIR = path.join(process.cwd(), 'src', 'sql-scripts');

/**
 * Server Action to get a list of .sql files from the src/sql-scripts directory.
 * Filters out files that start with "admin_".
 * @returns A promise that resolves to an array of SQL script filenames.
 * @throws Throws an error if reading the directory fails.
 */
export async function getSqlScriptFiles(): Promise<string[]> {
  try {
    // Ensure the directory exists
    try {
      await fs.access(SQL_SCRIPTS_DIR);
    } catch (error) {
      // If directory doesn't exist, create it
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.mkdir(SQL_SCRIPTS_DIR, { recursive: true });
        console.log(`Created directory: ${SQL_SCRIPTS_DIR}`);
        return []; // Return empty array as there are no files yet
      }
      throw error; // Re-throw other access errors
    }

    const files = await fs.readdir(SQL_SCRIPTS_DIR);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql') && !file.toLowerCase().startsWith('admin_')); // Ensure case-insensitive check for "admin_"
    return sqlFiles;
  } catch (error) {
    console.error('Error reading SQL script files:', error);
    // Handle specific error types if necessary, e.g., directory not found
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // This case should be handled by the access check above, but as a fallback:
      return []; // Directory doesn't exist, so no files
    }
    throw new Error('Failed to retrieve SQL script files.');
  }
}
