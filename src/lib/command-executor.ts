// src/lib/command-executor.ts
// src/lib/command-executor.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import { type LogEntry } from '@/types/log-types'; // Import the new LogEntry type
import type { CommandMode } from '@/types/command-types';
import { runSql } from '@/lib/database';
import { formatResultsAsTable } from '@/lib/formatting';
import { handleInternalCommand } from '@/lib/internal-commands'; // Import the central internal command handler
import { storeVariableInDb } from '@/lib/variables'; // Import variable storing function
// Removed: import { readClipboardText } from '@/lib/clipboard'; // Import clipboard function - Cannot be used in Server Action

interface ExecuteCommandParams {
  command: string;
  mode: CommandMode; // This is now the *classified category* passed from the client
  addSuggestion: (mode: CommandMode, command: string) => void; // Potentially problematic in Server Action
  addCustomCommand: (name: string, action: CustomCommandAction) => void; // Potentially problematic in Server Action
  getCustomCommandAction: (name: string) => CustomCommandAction | undefined; // Potentially problematic in Server Action
  currentLogEntries: LogEntry[]; // Pass current log entries (uses new LogEntry type)
  initialSuggestions: Record<string, string[]>;
}

// Define the return type to include potentially updated log entries
interface ExecuteCommandResult {
  outputLines: OutputLine[];
  newLogEntries?: LogEntry[]; // Include new log entries if they were modified (uses new LogEntry type)
}

/**
 * Executes a command based on the *classified mode/category* and returns output lines.
 * Delegates internal command handling to a separate module.
 * Handles variable assignments if classified as 'internal'.
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
  const commandTrimmed = command.trim();
  const commandLower = commandTrimmed.toLowerCase();

  // Command output line now uses the classified mode as its category
  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command,
    type: 'command',
    category: mode, // Use the classified mode here
    timestamp: timestamp,
  };

  let outputLines: OutputLine[] = [];
  let potentiallyUpdatedLogs: LogEntry[] | undefined = undefined; // Track log changes
  let logEntry: LogEntry | null = null; // Variable to hold a potential new log entry

  // --- Dispatch based on Classified Mode ---
  try {
      // --- Internal Variable Assignment Handling ---
      // If classified as internal and matches assignment pattern
      const assignmentRegex = /^\s*([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/;
      const assignmentMatch = commandTrimmed.match(assignmentRegex);

      if (mode === 'internal' && assignmentMatch) {
         const variableName = assignmentMatch[1];
         const valueString = assignmentMatch[2].trim();
         let dataType = 'unknown';
         let actualValue: any = valueString;

         // Infer data type (simple inference)
         if (/^\d+$/.test(valueString)) {
             dataType = 'integer';
             actualValue = parseInt(valueString, 10);
         } else if (/^\d+\.\d+$/.test(valueString)) {
             dataType = 'real';
             actualValue = parseFloat(valueString);
         } else if (valueString === 'True' || valueString === 'False') {
             dataType = 'boolean';
             actualValue = valueString === 'True';
         } else if ((valueString.startsWith('"') && valueString.endsWith('"')) || (valueString.startsWith("'") && valueString.endsWith("'"))) {
             dataType = 'string';
             actualValue = valueString.slice(1, -1);
         } else {
             // Treat unquoted strings or other patterns as string by default
             dataType = 'string';
             actualValue = valueString;
         }

         try {
            // Store in DB (pass the string representation for the DB)
            await storeVariableInDb(variableName, String(actualValue), dataType);
            outputLines = []; // Simulate no direct output for assignment
            logEntry = { timestamp, type: 'I', text: `Stored/Updated internal variable '${variableName}' with type '${dataType}' and value: ${String(actualValue)}` };
         } catch (error) {
            console.error("Error storing variable:", error);
            const errorMsg = `Error storing internal variable '${variableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            outputLines = [{ id: `assign-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp }];
            logEntry = { timestamp, type: 'E', text: errorMsg };
         }
      }
      // --- Other Internal Commands ---
      else if (mode === 'internal') {
        const commandName = commandLower.split(' ')[0];
        // Internal commands are handled by a dedicated module
        const internalResult = await handleInternalCommand({
            command: commandTrimmed,
            commandLower,
            commandName,
            args: commandTrimmed.split(' ').slice(1),
            timestamp,
            addSuggestion: addSuggestion,
            addCustomCommand: addCustomCommand,
            getCustomCommandAction: getCustomCommandAction,
            currentLogEntries: currentLogEntries,
            initialSuggestions: initialSuggestions
        });
         outputLines = internalResult.outputLines;
         potentiallyUpdatedLogs = internalResult.newLogEntries; // Capture potential log changes
      }
      // --- Other Category Handlers ---
      else if (mode === 'python') {
         // Handle Python variable assignment (different from internal)
         // The command should arrive here with the clipboard value already substituted by the client
         if (assignmentMatch) {
             const variableName = assignmentMatch[1];
             const valueString = assignmentMatch[2].trim();
             let dataType = 'unknown';
             let actualValue: any = valueString;

             // Infer data type for Python
             if (/^\d+$/.test(valueString)) {
                 dataType = 'integer';
                 actualValue = parseInt(valueString, 10);
             } else if (/^\d+\.\d+$/.test(valueString)) {
                 dataType = 'real'; // Use 'real' consistent with DB
                 actualValue = parseFloat(valueString);
             } else if (valueString === 'True' || valueString === 'False') {
                 dataType = 'boolean';
                 actualValue = valueString === 'True';
             } else if ((valueString.startsWith('"') && valueString.endsWith('"')) || (valueString.startsWith("'") && valueString.endsWith("'"))) {
                 dataType = 'string';
                 actualValue = valueString.slice(1, -1);
             } else if (valueString.toLowerCase() === 'none') {
                 dataType = 'none';
                 actualValue = null; // Represent None as null
             }
             // Removed clipboard get() handling here - it's done client-side now
             else {
                 // Treat unquoted strings or other patterns as string by default
                  dataType = 'string'; // Default to string if not recognized type
                  actualValue = valueString;
                  console.warn(`Python variable assignment for '${variableName}' treated as string: ${valueString}`);
             }

              // Store the variable value (which might have come from the clipboard originally)
              try {
                  await storeVariableInDb(variableName, String(actualValue), dataType);
                  outputLines = []; // No direct output for assignment
                  logEntry = { timestamp, type: 'I', text: `Stored/Updated Python variable '${variableName}' with type '${dataType}' and value: ${String(actualValue)}` };
              } catch (error) {
                  console.error("Error storing Python variable:", error);
                  const errorMsg = `Error storing Python variable '${variableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                  outputLines = [{ id: `py-assign-err-${timestamp}`, text: errorMsg, type: 'error', category: 'python', timestamp }];
                  logEntry = { timestamp, type: 'E', text: errorMsg };
              }


         }
         // --- Other Python Commands (Simulation) ---
         else if (commandLower.startsWith('print(')) {
            const match = commandTrimmed.match(/print\((['"]?)(.*?)\1\)/);
            const printOutput = match ? match[2] : 'Syntax Error in print';
            const type = match ? 'output' : 'error';
            outputLines = [{ id: `out-${timestamp}`, text: printOutput, type: type, category: 'python', timestamp: type === 'error' ? timestamp : undefined }];
            logEntry = { timestamp, type: match ? 'I' : 'E', text: `Python print: ${printOutput}` };
         } else {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100)); // Simulate delay
            const simOutput = `Simulating Python: ${commandTrimmed} (output placeholder)`;
            outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'python', timestamp: undefined }]; // timestamp was missing
            logEntry = { timestamp, type: 'I', text: simOutput };
         }
      }
      else if (mode === 'unix') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 100));
         let simOutput = `Simulating Unix: ${commandTrimmed} (output placeholder)`;
         if (commandLower === 'ls') {
             simOutput = 'file1.txt  directoryA  script.sh';
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined }];
             logEntry = { timestamp, type: 'I', text: `Unix simulation output: ${simOutput}` };
         } else if (commandLower.startsWith('echo ')) {
             // Removed specific "Hello SimShell Demo!" case
             simOutput = commandTrimmed.substring(5); // General echo simulation
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined }];
             logEntry = { timestamp, type: 'I', text: `Unix simulation output: ${simOutput}` };
         } else {
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined }]; // Use standard no timestamp format
             logEntry = { timestamp, type: 'I', text: `Unix simulation output: ${simOutput}` };
         }
      }
      else if (mode === 'windows') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 150));
         let simOutput = `Simulating Windows: ${commandTrimmed} (output placeholder)`;
         if (commandLower === 'dir') {
             simOutput = ' Volume in drive C has no label.\n Volume Serial Number is XXXX-YYYY\n\n Directory of C:\\Users\\User\n\nfile1.txt\n<DIR>          directoryA\nscript.bat\n               3 File(s) ... bytes\n               1 Dir(s)  ... bytes free';
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined }];
         } else if (commandLower.startsWith('echo ')) {
             simOutput = commandTrimmed.substring(5);
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined }];
         } else {
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined }]; // Use standard no timestamp format
         }
         logEntry = { timestamp, type: 'I', text: `Windows simulation output: ${simOutput}` };
      }
      else if (mode === 'sql') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
         try {
           const { results, changes, lastInsertRowid } = await runSql(commandTrimmed);

           if (results) {
             const formattedTable = await formatResultsAsTable(results); // Await the async function
             const sqlOutput = formattedTable || "Query executed successfully, no results returned.";
             outputLines = [{ id: `out-${timestamp}`, text: sqlOutput, type: 'output', category: 'sql', timestamp: undefined }];
             logEntry = { timestamp, type: 'I', text: `SQL query result: ${sqlOutput}` };
           } else if (changes !== null) {
             let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
             if (lastInsertRowid !== null && lastInsertRowid > 0) {
                infoText += ` Last inserted row ID: ${lastInsertRowid}`;
             }
             outputLines = [{ id: `out-${timestamp}`, text: infoText, type: 'info', category: 'sql', timestamp }];
             logEntry = { timestamp, type: 'I', text: infoText };
           } else {
              const successMsg = "Query executed successfully.";
              outputLines = [{ id: `out-${timestamp}`, text: successMsg, type: 'info', category: 'sql', timestamp }];
              logEntry = { timestamp, type: 'I', text: successMsg };
           }
         } catch (error) {
           console.error("SQL execution error:", error);
           const errorMsg = error instanceof Error ? error.message : 'Unknown SQL execution error';
           outputLines = [{ id: `err-${timestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp }];
           logEntry = { timestamp, type: 'E', text: `SQL Error: ${errorMsg}` };
         }
      }
      else if (mode === 'excel') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
         let excelOutput = `Simulating Excel: ${commandTrimmed} (output placeholder)`;
         let excelLogType: 'I' | 'E' = 'I';
         let outputType: 'output' | 'error' = 'output';
         if (commandLower.startsWith('sum(')) {
             const numbersMatch = commandTrimmed.match(/sum\(([\d\s,.]+)\)/i);
             if (numbersMatch && numbersMatch[1]) {
                 try {
                     const numbers = numbersMatch[1].split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                     const sum = numbers.reduce((acc, val) => acc + val, 0);
                     excelOutput = `${sum}`;
                     outputType = 'output';
                 } catch (e) {
                     excelOutput = '#VALUE!';
                     excelLogType = 'E';
                     outputType = 'error';
                 }
             } else {
                  excelOutput = '#NAME?';
                  excelLogType = 'E';
                  outputType = 'error';
             }
         }
         outputLines = [{ id: `out-${timestamp}`, text: excelOutput, type: outputType, category: 'excel', timestamp: outputType === 'error' ? timestamp : undefined }];
         logEntry = { timestamp, type: excelLogType, text: `Excel simulation output: ${excelOutput}` };
      }
       else {
         const errorMsg = `Error: Command execution logic not implemented for category '${mode}'.`;
         outputLines = [{ id: `err-unknown-mode-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp }];
         logEntry = { timestamp, type: 'E', text: errorMsg };
       }

  } catch (error) { // Catch errors from handlers themselves
      console.error("Unhandled error during command execution:", error);
      const errorMsg = `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      outputLines = [{ id: `fatal-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp }];
      logEntry = { timestamp, type: 'E', text: errorMsg };
  }


  // Combine logs if a new entry was created outside internal handlers
  let finalLogEntries = potentiallyUpdatedLogs;
  if (!finalLogEntries && logEntry) {
      finalLogEntries = [...currentLogEntries, logEntry];
  } else if (finalLogEntries && logEntry) {
       // If internal handler already updated logs, we might need to decide whether to add the generic log too.
        if (logEntry.text.includes('variable')) {
           // If it's a variable assignment log, add it even if internal handler modified logs.
            finalLogEntries = [...finalLogEntries, logEntry];
        } else {
            console.warn("Log entry generated but internal handler also modified logs. Generic log ignored.");
        }
  }


  // Return the result object
  // Always include the command itself in the output
  return {
    outputLines: [commandOutput, ...outputLines],
    newLogEntries: finalLogEntries, // Return updated logs if they changed
  };
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'command-executor.ts';
}
