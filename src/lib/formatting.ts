// src/lib/formatting.ts
// src/lib/formatting.ts

/**
 * Formats database results (array of objects) into a simple text table.
 * Marked as async as it's used within Server Actions.
 * @param results Array of result objects from better-sqlite3.
 * @returns A string representing the formatted table, or null if no results.
 */
export async function formatResultsAsTable(results: any[]): Promise<string | null> {
    if (!results || results.length === 0) {
        return "(0 rows)"; // Indicate no results
    }

    const headers = Object.keys(results[0]);
    const columnWidths = headers.map(header => header.length);

    // Calculate max width for each column based on data
    results.forEach(row => {
        headers.forEach((header, index) => {
            const value = row[header];
            // Ensure value is converted to string safely, handle null/undefined
            const valueString = (value === null || value === undefined) ? 'null' : String(value);
            const valueLength = valueString.length;
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
            // Ensure value is converted to string safely, handle null/undefined
            const stringValue = (value === null || value === undefined) ? 'null' : String(value);
            return stringValue.padEnd(columnWidths[index]);
        }).join(' | ');
    });

    return [headerLine, separatorLine, ...dataLines, `(${results.length} row${results.length === 1 ? '' : 's'})`].join('\n');
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'formatting.ts';
}
