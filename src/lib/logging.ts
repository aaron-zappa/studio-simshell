// src/lib/logging.ts
// src/lib/logging.ts
'use client';

import type { OutputLine } from '@/components/output-display'; // Import OutputLine
import { type LogEntry } from '@/types/log-types'; // Import the new LogEntry type
import * as path from 'path'; // Import path for basename - needed for getFilename

/**
 * Generates a CSV string from the log entries and triggers a download.
 * This function uses browser APIs and should only be called client-side.
 * @param logEntries - The array of log entries using the new format.
 * @returns An OutputLine indicating success or failure, or null if no logs.
 */
export const exportLogFile = (logEntries: LogEntry[]): OutputLine | null => {
    const timestamp = new Date().toISOString();
    if (logEntries.length === 0) {
        // Return an OutputLine directly if there are no logs
        return { id: `log-export-empty-${timestamp}`, text: 'No log entries to export.', type: 'info', category: 'internal', flag: 0 }; // Added flag
    }

    try {
        // Define CSV header for the new format including 'flag'
        const header = 'timestamp,type,flag,text\n'; // Updated header

        // Convert log entries to CSV rows, quoting fields appropriately
        const rows = logEntries.map(entry => {
            // Basic CSV quoting for text field
            const textCsv = entry.text.includes(',') || entry.text.includes('"') || entry.text.includes('\n')
                ? `"${entry.text.replace(/"/g, '""')}"`
                : entry.text;
            return [
                entry.timestamp,
                entry.type,
                entry.flag, // Add the flag value
                textCsv
            ].join(',');
        }).join('\n');

        const csvContent = header + rows;

        // Create a Blob from the CSV string
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

        // Create a link element
        const link = document.createElement('a');
        if (link.download !== undefined) { // Check if download attribute is supported
            // Create a URL for the Blob
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'logfile.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up the URL object
             return { id: `log-export-success-${timestamp}`, text: 'Log file exported successfully as logfile.csv.', type: 'info', category: 'internal', flag: 0 }; // Added flag
        } else {
             console.error('Browser does not support automatic downloading.');
             return { id: `log-export-fail-${timestamp}`, text: 'Error: Browser does not support automatic download.', type: 'error', category: 'internal', flag: 1 }; // Error flag
        }
    } catch (error) {
        console.error('Error exporting log file:', error);
        return { id: `log-export-error-${timestamp}`, text: `Error exporting log file: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error', category: 'internal', flag: 1 }; // Error flag
    }
};


/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'logging.ts';
}

// --- Removed old LogEntry structure and related functions (requiArr, getRequiArr, addLogEntry) ---
// The 'show requirements' command logic is now in its own handler file.
// Logging should now happen within command handlers by creating LogEntry objects
// and returning them in the HandlerResult.

