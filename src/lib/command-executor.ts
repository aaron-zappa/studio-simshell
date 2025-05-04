
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import { addLogEntry, type LogEntry } from '@/lib/logging';
import type { CommandMode } from '@/types/command-types';
import { runSql } from '@/lib/database'; // Import database function
import { formatResultsAsTable } from '@/lib/formatting'; // Import formatting function
import { handleInternalCommand } from '@/lib/internal-commands'; // Import the central internal command handler

interface ExecuteCommandParams {
  command: string;
  mode: CommandMode;
  addSuggestion: (mode: CommandMode, command: string) => void;
  addCustomCommand: (name: string, action: CustomCommandAction) => void;
  getCustomCommandAction: (name: string) => CustomCommandAction | undefined;
  logEntries: LogEntry[]; // Pass current log entries
  setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>; // Pass setter for logging
  initialSuggestions: Record<string, string[]>; // Pass initial suggestions for mode checking etc.
}

/**
 * Executes a command based on the current mode and returns output lines.
 * Delegates internal command handling to a separate module.
 * This is intended to be used as a Server Action.
 */
export const executeCommand = async ({
    command,
    mode,
    addSuggestion,
    addCustomCommand,
    getCustomCommandAction,
    logEntries,
    setLogEntries,
    initialSuggestions
}: ExecuteCommandParams): Promise<OutputLine[]> => {
  const timestamp = new Date().toISOString(); // Simple unique ID
  const commandLower = command.toLowerCase().trim();
  const commandName = commandLower.split(' ')[0];

  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command, // Show the original command casing
    type: 'command',
    category: mode,
  };

  let outputLines: OutputLine[] = [];

  // --- Internal Commands Handling ---
  if (mode === 'internal') {
    outputLines = await handleInternalCommand({
        command,
        commandLower,
        commandName,
        args: command.split(' ').slice(1),
        timestamp,
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        logEntries,
        setLogEntries,
        initialSuggestions
    });
  }
  // --- Python simulation ---
  else if (mode === 'python') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200)); // 0.2-1.2 sec delay
     if (commandLower.startsWith('print(')) {
        const match = command.match(/print\((['"])(.*?)\1\)/);
        outputLines = [{ id: `out-${timestamp}`, text: match ? match[2] : 'Syntax Error in print', type: match ? 'output' : 'error', category: 'python' }];
     } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Simulating Python: ${command} (output placeholder)`, type: 'output', category: 'python' }];
     }
  }
   // --- Unix simulation ---
  else if (mode === 'unix') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 100)); // 0.1-0.9 sec delay
     if (commandLower === 'ls') {
         outputLines = [{ id: `out-${timestamp}`, text: 'file1.txt  directoryA  script.sh', type: 'output', category: 'unix' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'unix' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Unix: ${command} (output placeholder)`, type: 'output', category: 'unix' }];
     }
  }
    // --- Windows simulation ---
  else if (mode === 'windows') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 150)); // 0.15-1.05 sec delay
     if (commandLower === 'dir') {
         outputLines = [{ id: `out-${timestamp}`, text: ' Volume in drive C has no label.\n Volume Serial Number is XXXX-YYYY\n\n Directory of C:\\Users\\User\n\nfile1.txt\n<DIR>          directoryA\nscript.bat\n               3 File(s) ... bytes\n               1 Dir(s)  ... bytes free', type: 'output', category: 'windows' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'windows' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Windows: ${command} (output placeholder)`, type: 'output', category: 'windows' }];
     }
  }
    // --- SQL execution ---
  else if (mode === 'sql') {
     await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50)); // Shorter delay for DB query
     try {
       // Execute the SQL command using the database service
       const { results, changes, lastInsertRowid } = runSql(command); // Pass the raw SQL command

       if (results) {
         // Format results as a table using the imported function
         const formattedTable = formatResultsAsTable(results);
         outputLines = [{ id: `out-${timestamp}`, text: formattedTable || "Query executed successfully, no results returned.", type: 'output', category: 'sql' }];
       } else if (changes !== null) {
         // Output info for INSERT, UPDATE, DELETE
         let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
         if (lastInsertRowid !== null && lastInsertRowid > 0) { // Check if lastInsertRowid is valid
            infoText += ` Last inserted row ID: ${lastInsertRowid}`;
         }
         outputLines = [{ id: `out-${timestamp}`, text: infoText, type: 'info', category: 'sql' }];
       } else {
          // For commands like CREATE TABLE, etc., that don't return rows or changes directly
          outputLines = [{ id: `out-${timestamp}`, text: "Query executed successfully.", type: 'info', category: 'sql' }];
       }
     } catch (error) {
       console.error("SQL execution error:", error);
       outputLines = [{ id: `err-${timestamp}`, text: error instanceof Error ? error.message : 'Unknown SQL execution error', type: 'error', category: 'sql' }];
     }
  }
    // --- Excel simulation ---
  else if (mode === 'excel') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100)); // 0.1-0.6 sec delay
     if (commandLower.startsWith('sum(')) {
         // Basic simulation: Try to extract numbers and sum them
         const numbersMatch = command.match(/sum\(([\d\s,.]+)\)/i);
         if (numbersMatch && numbersMatch[1]) {
             try {
                 const numbers = numbersMatch[1].split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                 const sum = numbers.reduce((acc, val) => acc + val, 0);
                 outputLines = [{ id: `out-${timestamp}`, text: `${sum}`, type: 'output', category: 'excel' }];
             } catch (e) {
                 outputLines = [{ id: `out-${timestamp}`, text: '#VALUE!', type: 'error', category: 'excel' }];
             }
         } else {
              outputLines = [{ id: `out-${timestamp}`, text: '#NAME?', type: 'error', category: 'excel' }];
         }
     } else {
          outputLines = [{ id: `out-${timestamp}`, text: `Simulating Excel: ${command} (output placeholder)`, type: 'output', category: 'excel' }];
     }
  }

  // Always return the command itself followed by any output lines generated
  return [commandOutput, ...outputLines];
};
