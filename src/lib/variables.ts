// src/lib/variables.ts
// src/lib/variables.ts
'use server';

import { runSql } from './database';

/**
 * Stores or updates a variable in the specified table (defaults to 'variables').
 * @param name - The name of the variable.
 * @param value - The value of the variable (as a string).
 * @param datatype - The inferred data type of the variable.
 * @param tableName - Optional. The name of the table to store the variable in. Defaults to 'variables'.
 * @param min - Optional minimum value.
 * @param max - Optional maximum value.
 * @param defaultValue - Optional default value.
 */
export async function storeVariableInDb(
    name: string,
    value: string,
    datatype: string,
    tableName: string = 'variables', // Added tableName parameter with default
    min?: number | null,
    max?: number | null,
    defaultValue?: string | null
): Promise<void> {
    // Dynamically use the tableName in the SQL query
    const sql = `
        INSERT INTO ${tableName} (name, datatype, value, min, max, default_value)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            datatype = excluded.datatype,
            value = excluded.value,
            min = excluded.min,
            max = excluded.max,
            default_value = excluded.default_value;
    `;
    // Ensure optional numeric values are null if undefined
    const params = [
        name,
        datatype,
        value,
        min === undefined ? null : min,
        max === undefined ? null : max,
        defaultValue === undefined ? null : defaultValue
    ];

    try {
        await runSql(sql, params);
        console.log(`Stored/Updated variable '${name}' in table '${tableName}' with value '${value}' and type '${datatype}'`);
    } catch (error) {
        console.error(`Error storing variable '${name}' in table '${tableName}':`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

/**
 * Retrieves a variable's details from the database.
 * @param name - The name of the variable to retrieve.
 * @returns An object with the variable details, or null if not found.
 */
export async function getVariableFromDb(name: string): Promise<{
    name: string;
    datatype: string;
    value: string;
    min: number | null;
    max: number | null;
    default_value: string | null;
} | null> {
    // For now, this function still primarily targets the 'variables' table.
    // If 'ai_answer' or other specific variables might be in 'variables2',
    // this function (or the calling logic) would need to be aware of that.
    // The current request focuses on *storing* to 'variables2' as a fallback.
    const sql = 'SELECT name, datatype, value, min, max, default_value FROM variables WHERE name = ?';
    try {
        const { results } = await runSql(sql, [name]);
        if (results && results.length > 0) {
            // Assuming the database stores min/max as potentially null numbers and default_value as potentially null string
            const row = results[0];
             return {
                name: row.name,
                datatype: row.datatype,
                value: row.value, // Value is stored as TEXT
                min: row.min,     // Assume REAL in DB, maps to number or null
                max: row.max,     // Assume REAL in DB, maps to number or null
                default_value: row.default_value // Assume TEXT in DB, maps to string or null
             };
        }
        return null; // Variable not found
    } catch (error) {
        console.error(`Error retrieving variable '${name}' from database:`, error);
        throw error; // Re-throw
    }
}


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'variables.ts';
}
