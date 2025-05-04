// src/lib/logging.ts
// src/lib/logging.ts
'use client';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display'; // Import OutputLine
import * as path from 'path'; // Import path for basename


/**
 * Represents a single log entry for a command addition.
 */
export type LogEntry = {
  timestamp: string;
  short: string;
  commandName: string;
  description: string;
  action: CustomCommandAction;
};

// Define the structure for the requirement array elements
export interface RequiElement { // Exporting for use in handle-show-requirements.ts
  requi_code: keyof LogEntry; // Use keys of LogEntry for type safety
  requirement: string;
}

// Array describing the fields (requirements) of a LogEntry
const requiArr: RequiElement[] = [
  { requi_code: 'timestamp', requirement: 'ISO string timestamp of when the command was added.' },
  { requi_code: 'short', requirement: 'Short alias or identifier for the command.' },
  { requi_code: 'commandName', requirement: 'The full name of the added internal command.' },
  { requi_code: 'description', requirement: 'A description of what the command does.' },
  { requi_code: 'action', requirement: 'The action (string) to be executed when the command is run.' },
];

/**
 * Returns the array describing the fields required for a LogEntry.
 * @returns An array of objects, each with 'requi_code' and 'requirement'.
 */
export function getRequiArr(): RequiElement[] {
  // We don't modify requi_code here; modification happens in handleShowRequirements
  return requiArr;
}


/**
 * Appends a new log entry to the log state.
 * WARNING: This function signature relying on React state setters is problematic
 * within Server Actions. It's kept for conceptual demonstration but needs refactoring
 * for a robust server-side logging mechanism (e.g., database write).
 * @param entry - The log entry to add.
 * @param setLogEntries - The React state setter function for log entries.
 */
export const addLogEntry = (entry: LogEntry, setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>) => {
  // This approach is flawed in Server Actions.
  // A server action should typically return data or status, not directly call client state setters.
  console.warn("Calling addLogEntry with setLogEntries directly in a Server Action context is not recommended practice.");
  // To maintain functionality for now, we call the setter, but this relies on potentially outdated closures.
   try {
      setLogEntries((prev) => [...prev, entry]);
   } catch (error) {
       console.error("Failed to update log entries via setLogEntries in Server Action context:", error);
       // Consider alternative logging mechanisms or returning the entry to the client to handle state update.
   }
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
        // Return an OutputLine directly if there are no logs
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

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'logging.ts';
}
