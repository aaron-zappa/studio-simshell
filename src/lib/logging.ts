// src/lib/logging.ts
'use client';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display'; // Import OutputLine

/**
 * Represents a single log entry for a command addition.
 */
export type LogEntry = {
  timestamp: string;
  short: string; // Added short name field
  commandName: string;
  description: string; // Added description field
  action: CustomCommandAction;
};

/**
 * Appends a new log entry to the log state.
 * This should ideally be replaced with a proper logging mechanism (e.g., database call)
 * when used within Server Actions to avoid direct state manipulation issues.
 * @param entry - The log entry to add.
 * @param setLogEntries - The React state setter function for log entries.
 */
export const addLogEntry = (entry: LogEntry, setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>) => {
  // Warning: Directly modifying client state from a server action context like this is problematic.
  // Consider returning the log entry or using a dedicated logging service/database call.
  setLogEntries((prev) => [...prev, entry]);
};

/**
 * Generates a CSV string from the log entries and triggers a download.
 * This function uses browser APIs and should only be called client-side.
 * @param logEntries - The array of log entries.
 * @returns An OutputLine indicating success or failure, or null if no logs.
 */
export const exportLogFile = (logEntries: LogEntry[]): OutputLine | null => {
    const timestamp = new Date().toISOString();
    if (logEntries.length === 0) {
        return { id: `log-export-empty-${timestamp}`, text: 'No log entries to export.', type: 'info', category: 'internal' };
    }

    try {
        // Define CSV header including Short and Description
        const header = 'Timestamp,Short,CommandName,Description,Action\n'; // Added Short

        // Convert log entries to CSV rows, quoting fields appropriately
        const rows = logEntries.map(entry =>
            [
                entry.timestamp,
                `"${entry.short.replace(/"/g, '""')}"`, // Add short field
                `"${entry.commandName.replace(/"/g, '""')}"`,
                `"${entry.description.replace(/"/g, '""')}"`,
                `"${entry.action.replace(/"/g, '""')}"`
            ].join(',')
        ).join('\n');

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
             return { id: `log-export-success-${timestamp}`, text: 'Log file exported successfully as logfile.csv.', type: 'info', category: 'internal' };
        } else {
             console.error('Browser does not support automatic downloading.');
             return { id: `log-export-fail-${timestamp}`, text: 'Error: Browser does not support automatic download.', type: 'error', category: 'internal' };
        }
    } catch (error) {
        console.error('Error exporting log file:', error);
        return { id: `log-export-error-${timestamp}`, text: `Error exporting log file: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error', category: 'internal' };
    }
};
