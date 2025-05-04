// src/lib/command-executor.ts
// src/lib/command-executor.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import { addLogEntry, type LogEntry } from '@/lib/logging';
import type { CommandMode } from '@/types/command-types'; // CommandMode now represents the classified category
import { runSql } from '@/lib/database';
import { formatResultsAsTable } from '@/lib/formatting';
import { handleInternalCommand } from '@/lib/internal-commands'; // Import the central internal command handler

interface ExecuteCommandParams {
  command: string;
  mode: CommandMode; // This is now the *classified category* passed from the client
  addSuggestion: (mode: CommandMode, command: string) => void; // Potentially problematic in Server Action
  addCustomCommand: (name: string, action: CustomCommandAction) => void; // Potentially problematic in Server Action
  getCustomCommandAction: (name: string) => CustomCommandAction | undefined; // Potentially problematic in Server Action
  currentLogEntries: LogEntry[]; // Pass current logs for modification
  initialSuggestions: Record<string, string[]>; // Passed for 'help' and validation
}

// Define the return type to include potentially updated log entries
interface ExecuteCommandResult {
  outputLines: OutputLine[];
  newLogEntries?: LogEntry[]; // Include new log entries if they were modified
}

/**
 * Executes a command based on the *classified mode/category* and returns output lines.
 * Delegates internal command handling to a separate module.
 * This is intended to be used as a Server Action.
 */
export async function executeCommand ({
    command,
    mode, // mode is the classified category
    addSuggestion,
    addCustomCommand,
    getCustomCommandAction,
    currentLogEntries, // Receive current logs
    initialSuggestions
}: ExecuteCommandParams): Promise<ExecuteCommandResult> { // Return the result object
  const timestamp = new Date().toISOString();
  const commandLower = command.toLowerCase().trim();
  const commandName = commandLower.split(' ')[0];

  // Command output line now uses the classified mode as its category
  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command,
    type: 'command',
    category: mode, // Use the classified mode here
  };

  let outputLines: OutputLine[] = [];
  let potentiallyUpdatedLogs: LogEntry[] | undefined = undefined; // Track log changes

  // --- Dispatch based on Classified Mode ---
  if (mode === 'internal') {
    // Internal commands are handled by a dedicated module
    // It now returns an object including potential log updates
     const internalResult = await handleInternalCommand({
        command,
        commandLower,
        commandName,
        args: command.split(' ').slice(1),
        timestamp,
        // Functions like addSuggestion/addCustomCommand/getCustomCommandAction are tricky in Server Actions
        // as they often rely on client-side state. Passing them is generally not recommended
        // unless they are adapted to work server-side (e.g., modifying a database).
        // For now, we pass them but acknowledge this limitation.
        addSuggestion: addSuggestion, // PROBLEM: Modifies client state
        addCustomCommand: addCustomCommand, // PROBLEM: Modifies client state
        getCustomCommandAction: getCustomCommandAction, // PROBLEM: Reads client state
        currentLogEntries: currentLogEntries, // Pass current logs
        initialSuggestions: initialSuggestions
    });
     outputLines = internalResult.outputLines;
     potentiallyUpdatedLogs = internalResult.newLogEntries; // Capture potential log changes
  }
  else if (mode === 'python') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));
     if (commandLower.startsWith('print(')) {
        const match = command.match(/print\((['"])(.*?)\1\)/);
        outputLines = [{ id: `out-${timestamp}`, text: match ? match[2] : 'Syntax Error in print', type: match ? 'output' : 'error', category: 'python' }];
     } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Simulating Python: ${command} (output placeholder)`, type: 'output', category: 'python' }];
     }
  }
  else if (mode === 'unix') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 100));
     if (commandLower === 'ls') {
         outputLines = [{ id: `out-${timestamp}`, text: 'file1.txt  directoryA  script.sh', type: 'output', category: 'unix' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'unix' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Unix: ${command} (output placeholder)`, type: 'output', category: 'unix' }];
     }
  }
  else if (mode === 'windows') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 150));
     if (commandLower === 'dir') {
         outputLines = [{ id: `out-${timestamp}`, text: ' Volume in drive C has no label.\n Volume Serial Number is XXXX-YYYY\n\n Directory of C:\\Users\\User\n\nfile1.txt\n<DIR>          directoryA\nscript.bat\n               3 File(s) ... bytes\n               1 Dir(s)  ... bytes free', type: 'output', category: 'windows' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'windows' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Windows: ${command} (output placeholder)`, type: 'output', category: 'windows' }];
     }
  }
  else if (mode === 'sql') {
     await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
     try {
       const { results, changes, lastInsertRowid } = await runSql(command); // runSql is async now

       if (results) {
         const formattedTable = formatResultsAsTable(results);
         outputLines = [{ id: `out-${timestamp}`, text: formattedTable || "Query executed successfully, no results returned.", type: 'output', category: 'sql' }];
       } else if (changes !== null) {
         let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
         if (lastInsertRowid !== null && lastInsertRowid > 0) {
            infoText += ` Last inserted row ID: ${lastInsertRowid}`;
         }
         outputLines = [{ id: `out-${timestamp}`, text: infoText, type: 'info', category: 'sql' }];
       } else {
          outputLines = [{ id: `out-${timestamp}`, text: "Query executed successfully.", type: 'info', category: 'sql' }];
       }
     } catch (error) {
       console.error("SQL execution error:", error);
       outputLines = [{ id: `err-${timestamp}`, text: error instanceof Error ? error.message : 'Unknown SQL execution error', type: 'error', category: 'sql' }];
     }
  }
  else if (mode === 'excel') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
     if (commandLower.startsWith('sum(')) {
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
   else {
     // Fallback for any unexpected category/mode passed
     outputLines = [{ id: `err-unknown-mode-${timestamp}`, text: `Error: Command execution logic not implemented for category '${mode}'.`, type: 'error', category: 'internal' }];
   }


  // Return the result object
  return {
    outputLines: [commandOutput, ...outputLines],
    newLogEntries: potentiallyUpdatedLogs, // Return updated logs if they changed
  };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'command-executor.ts';
}
