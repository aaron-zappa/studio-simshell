// src/lib/command-executor.ts
// src/lib/command-executor.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';
import { formatResultsAsTable } from '@/lib/formatting';
import { handleInternalCommand } from '@/lib/internal-commands'; // Import the central internal command handler
import { storeVariableInDb } from '@/lib/variables'; // Import variable storing function
import { getUserPermissions } from '@/lib/permissions'; // Import permission fetching

interface ExecuteCommandParams {
  userId: number; // Add user ID
  command: string;
  mode: CommandMode; // This is now the *classified category* passed from the client
  currentLogEntries: LogEntry[]; // Pass current log entries (uses new LogEntry type)
  initialSuggestions: Record<string, string[]>;
}

// Define the return type to include potentially updated log entries and toast info
interface ExecuteCommandResult {
  outputLines: OutputLine[];
  newSuggestions?: { mode: CommandMode; command: string }[]; // Data for adding new suggestions
  newCustomCommands?: { name: string; action: CustomCommandAction }[]; // Data for adding new custom commands
  newLogEntries?: LogEntry[]; // Include new log entries if they were modified (uses new LogEntry type)
  toastInfo?: { message: string; variant?: 'default' | 'destructive' }; // Added for toast notifications
}

/**
 * Executes a command based on the *classified mode/category* and returns output lines.
 * Fetches user permissions and potentially modifies AI behavior based on them.
 * Delegates internal command handling to a separate module.
 * Handles variable assignments if classified as 'internal'.
 * This is intended to be used as a Server Action.
 */
export async function executeCommand ({
    userId, // Receive user ID
    command,
    mode, // mode is the classified category
    currentLogEntries, // Receive current logs
    initialSuggestions
}: ExecuteCommandParams): Promise<ExecuteCommandResult> { // Return the result object
  console.log(`[executeCommand] Received command: "${command}", Mode: "${mode}", User ID: ${userId}`);

  const timestamp = new Date().toISOString();
  const commandTrimmed = command.trim();
  const commandLower = commandTrimmed.toLowerCase();

  // Command output line now uses the classified mode as its category
  // Include flag in command output only if it's meant to be logged like an entry
  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command,
    type: 'command',
    category: mode, // Use the classified mode here
    timestamp: timestamp,
    // flag: 0 // Typically commands themselves don't have a flag unless logged specially
  };
  // --- Early Check for Help/Test ---
  if (commandLower === 'help' || commandLower === '?') {
    return {
      outputLines: [], // Return empty outputLines
      newLogEntries: [...currentLogEntries, { timestamp: timestamp, type: 'I', flag: 0, text: 'Database not initialized. Only AI command(s) are available.' }],
    };
  let outputLines: OutputLine[] = [];
  let potentiallyUpdatedLogs: LogEntry[] | undefined = undefined; // Track log changes
  let logEntry: LogEntry | null = null; // Variable to hold a potential new log entry
  let newSuggestions: ExecuteCommandResult['newSuggestions']; // Initialize newSuggestions
  let newCustomCommands: ExecuteCommandResult['newCustomCommands']; // Initialize newCustomCommands
  let toastInfoFromResult: ExecuteCommandResult['toastInfo']; // Initialize toastInfoFromResult

  // --- Rest of the Command Processing Logic ---

  // --- Fetch User Permissions ---
  let userPermissions: string[] = [];
  // Bypass permission fetching for now if we are overriding checks
  const OVERRIDE_PERMISSION_CHECKS = true; // Set to true to bypass checks

  if (OVERRIDE_PERMISSION_CHECKS) {
    userPermissions = ['override_all_permissions']; // Give a dummy permission
    logEntry = { timestamp, type: 'W', flag: 1, text: `WARNING: All permission checks are currently bypassed for user ${userId}.` };
    potentiallyUpdatedLogs = [...currentLogEntries, logEntry];
  } else {
      // Special case: Allow 'help' and 'init db' even if permissions can't be fetched (e.g., DB not ready)
      if (commandLower !== 'help' && commandLower !== 'init db') {
          const permResult = await getUserPermissions(userId);

          if (Array.isArray(permResult)) {
              userPermissions = permResult;
          } else {
              // Handle error fetching permissions
               console.error("Error fetching user permissions:", permResult.error);
               const errorMsg = permResult.code === 'DB_NOT_INITIALIZED'
                    ? "Permission check skipped: Database RBAC tables not initialized. Please run 'init db'."
                    : `Error fetching user permissions: ${permResult.error}`;
               outputLines.push({ id: `perm-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }); // Set flag to 0 for error
               logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
               potentiallyUpdatedLogs = [...currentLogEntries, logEntry];
               // Return early if permissions couldn't be fetched, as they might be critical
               return { outputLines: [commandOutput, ...outputLines], newLogEntries: potentiallyUpdatedLogs, toastInfo: toastInfoFromResult };
          }
      } else {
          // If it's 'help' or 'init db', skip strict permission fetching for now
           logEntry = { timestamp, type: 'I', flag: 0, text: `Permission check skipped for '${commandLower}'.` };
           potentiallyUpdatedLogs = potentiallyUpdatedLogs ? [...potentiallyUpdatedLogs, logEntry] : [...currentLogEntries, logEntry];
      }
  }


  // --- Dispatch based on Classified Mode ---
  try {
      // --- Permission Check Example (Apply where needed) ---
      // Example: Check if user can execute SQL modify commands
      if (!OVERRIDE_PERMISSION_CHECKS && mode === 'sql' && !userPermissions.includes('execute_sql_select') && !userPermissions.includes('execute_sql_modify')) {
          // Allow 'help'/'init db' check again, though it should be caught by the initial skip
          if (commandLower !== 'help' && commandLower !== 'init db') {
            const errorMsg = "Permission denied: You do not have permission to execute SQL queries.";
            outputLines = [{ id: `perm-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }]; // Set flag to 0 for error
            logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
            potentiallyUpdatedLogs = potentiallyUpdatedLogs ? [...potentiallyUpdatedLogs, logEntry] : [...currentLogEntries, logEntry];
            return { outputLines: [commandOutput, ...outputLines], newLogEntries: potentiallyUpdatedLogs, toastInfo: toastInfoFromResult };
          }
      }
      // Add more permission checks for other modes/actions as needed

      // --- Internal Variable Assignment Handling ---
      const assignmentRegex = /^\s*([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/;
      const assignmentMatch = commandTrimmed.match(assignmentRegex);

      if (mode === 'internal' && assignmentMatch) {
         // Permission check for managing variables
         if (!OVERRIDE_PERMISSION_CHECKS && !userPermissions.includes('manage_variables')) {
             const errorMsg = "Permission denied: Cannot manage internal variables.";
             throw new Error(errorMsg); // Throw to be caught by the main catch block
         }

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
            logEntry = { timestamp, type: 'I', flag: 0, text: `Stored/Updated internal variable '${variableName}' with type '${dataType}' and value: ${String(actualValue)}` };
         } catch (error: any) {
            console.error("Error storing variable:", error);
            const errorMsg = `Error storing internal variable '${variableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            outputLines = [{ id: `assign-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }]; // Set flag to 0 for error
            logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
         }
      }
      // --- Other Internal Commands ---
      else if (mode === 'internal') {
        const commandName = commandLower.split(' ')[0];
        // Internal commands are handled by a dedicated module
        const internalResult = await handleInternalCommand({
            userId, // Pass userId to internal command handler
            userPermissions, // Pass permissions
            command: commandTrimmed,
            commandLower,
            commandName,
            args: commandTrimmed.split(' ').slice(1),
            timestamp, // Pass timestamp
            currentLogEntries: potentiallyUpdatedLogs || currentLogEntries, // Pass logs that might include the override warning
            initialSuggestions: initialSuggestions,
            overridePermissionChecks: OVERRIDE_PERMISSION_CHECKS // Pass the override flag
        });
        outputLines = internalResult.outputLines; // Use outputLines from internalResult
        // Combine the logEntry created before internal command handling (if any)
        // with the logs returned by the internal handler.
        potentiallyUpdatedLogs = logEntry
            ? [...(internalResult.newLogEntries || []), logEntry]
            : internalResult.newLogEntries;
 potentiallyUpdatedLogs = internalResult.newLogEntries; // Capture potential log changes
         toastInfoFromResult = internalResult.toastInfo; // Capture toast info
 newSuggestions = internalResult.newSuggestions; // Assign newSuggestions from internalResult
 newCustomCommands = internalResult.newCustomCommands; // Assign newCustomCommands from internalResult
      }
      // --- Other Category Handlers ---
      else if (mode === 'python') {
         // Handle Python variable assignment (different from internal)
         // Permission check for managing python variables (assuming same perm as internal for now)
          if (assignmentMatch) {
              if (!OVERRIDE_PERMISSION_CHECKS && !userPermissions.includes('manage_variables')) {
                  const errorMsg = "Permission denied: Cannot manage Python variables.";
                  throw new Error(errorMsg);
              }
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
                  logEntry = { timestamp, type: 'I', flag: 0, text: `Stored/Updated Python variable '${variableName}' with type '${dataType}' and value: ${String(actualValue)}` };
              } catch (error: any) {
                  console.error("Error storing Python variable:", error);
                  const errorMsg = `Error storing Python variable '${variableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                  outputLines = [{ id: `py-assign-err-${timestamp}`, text: errorMsg, type: 'error', category: 'python', timestamp, flag: 0 }]; // Set flag to 0 for error
                  logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
              }


         }
         // --- Other Python Commands (Simulation) ---
         else if (commandLower.startsWith('print(')) {
            const matchPrint = commandTrimmed.match(/print\((['"]?)(.*?)\1\)/);
            const printOutput = matchPrint ? matchPrint[2] : 'Syntax Error in print';
            const type: OutputLine['type'] = matchPrint ? 'output' : 'error';
            outputLines = [{ id: `out-${timestamp}`, text: printOutput, type: type, category: 'python', timestamp: type === 'error' ? timestamp : undefined, flag: 0 }]; // Set flag to 0 for error
            logEntry = { timestamp, type: matchPrint ? 'I' : 'E', flag: matchPrint ? 0 : 0, text: `Python print: ${printOutput}` }; // Set flag to 0 for error
         } else {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100)); // Simulate delay
            const simOutput = `Simulating Python: ${commandTrimmed} (output placeholder)`;
            outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'python', timestamp: undefined, flag: 0 }]; // Add flag=0
            logEntry = { timestamp, type: 'I', flag: 0, text: simOutput };
         }
      }
      else if (mode === 'unix') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 100));
         let simOutput = `Simulating Unix: ${commandTrimmed} (output placeholder)`;
         if (commandLower === 'ls') {
             simOutput = 'file1.txt  directoryA  script.sh';
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined, flag: 0 }]; // Add flag=0
             logEntry = { timestamp, type: 'I', flag: 0, text: `Unix simulation output: ${simOutput}` };
         } else if (commandLower.startsWith('echo ')) {
             // Removed specific "Hello SimShell Demo!" case
             simOutput = commandTrimmed.substring(5); // General echo simulation
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined, flag: 0 }]; // Add flag=0
             logEntry = { timestamp, type: 'I', flag: 0, text: `Unix simulation output: ${simOutput}` };
         } else {
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'unix', timestamp: undefined, flag: 0 }]; // Add flag=0
             logEntry = { timestamp, type: 'I', flag: 0, text: `Unix simulation output: ${simOutput}` };
         }
      }
      else if (mode === 'windows') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 150));
         let simOutput = `Simulating Windows: ${commandTrimmed} (output placeholder)`;
         if (commandLower === 'dir') {
             simOutput = ' Volume in drive C has no label.\n Volume Serial Number is XXXX-YYYY\n\n Directory of C:\\Users\\User\n\nfile1.txt\n&lt;DIR&gt;          directoryA\nscript.bat\n               3 File(s) ... bytes\n               1 Dir(s)  ... bytes free';
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined, flag: 0 }]; // Add flag=0
         } else if (commandLower.startsWith('echo ')) {
             simOutput = commandTrimmed.substring(5);
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined, flag: 0 }]; // Add flag=0
         } else {
             outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'windows', timestamp: undefined, flag: 0 }]; // Add flag=0
         }
         logEntry = { timestamp, type: 'I', flag: 0, text: `Windows simulation output: ${simOutput}` };
      }
      else if (mode === 'sql') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
         try {
           // Check permissions based on query type (basic example)
           const isSelectQuery = commandTrimmed.trim().toUpperCase().startsWith('SELECT');
           if (!OVERRIDE_PERMISSION_CHECKS && isSelectQuery && !userPermissions.includes('execute_sql_select')) {
               throw new Error("Permission denied: Cannot execute SELECT queries.");
           }
           if (!OVERRIDE_PERMISSION_CHECKS && !isSelectQuery && !userPermissions.includes('execute_sql_modify')) {
                throw new Error("Permission denied: Cannot execute modifying SQL queries (INSERT, UPDATE, DELETE, etc.).");
           }

           const { results, changes, lastInsertRowid } = await runSql(commandTrimmed);

           if (results) {
             const formattedTable = await formatResultsAsTable(results); // Await the async function
             const sqlOutput = formattedTable || "Query executed successfully, no results returned.";
             outputLines = [{ id: `out-${timestamp}`, text: sqlOutput, type: 'output', category: 'sql', timestamp: undefined, flag: 0 }]; // Add flag=0
             logEntry = { timestamp, type: 'I', flag: 0, text: `SQL query result: ${sqlOutput}` };
           } else if (changes !== null) {
             let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
             if (lastInsertRowid !== null && lastInsertRowid > 0) {
                infoText += ` Last inserted row ID: ${lastInsertRowid}`;
             }
             outputLines = [{ id: `out-${timestamp}`, text: infoText, type: 'info', category: 'sql', timestamp, flag: 0 }]; // Add flag=0
             logEntry = { timestamp, type: 'I', flag: 0, text: infoText };
           } else {
              const successMsg = "Query executed successfully.";
              outputLines = [{ id: `out-${timestamp}`, text: successMsg, type: 'info', category: 'sql', timestamp, flag: 0 }]; // Add flag=0
              logEntry = { timestamp, type: 'I', flag: 0, text: successMsg };
           }
         } catch (error) {
           console.error(`[executeCommand] SQL execution error for command "${commandTrimmed}":`, error);
           const errorMsg = error instanceof Error ? error.message : 'Unknown SQL execution error';
            // Check if the error indicates missing tables (potentially from init db not being run)
            if (error instanceof Error && error.message.includes('no such table')) {
               const suggestInitMsg = `${errorMsg}. Consider running 'init db'.`;
               outputLines = [{ id: `err-${timestamp}`, text: suggestInitMsg, type: 'error', category: 'sql', timestamp, flag: 0 }]; // Set flag to 0 for error
               logEntry = { timestamp, type: 'E', flag: 0, text: `SQL Error: ${suggestInitMsg}` }; // Set flag to 0 for error
            } else {
                outputLines = [{ id: `err-${timestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp, flag: 0 }]; // Set flag to 0 for error
                logEntry = { timestamp, type: 'E', flag: 0, text: `SQL Error: ${errorMsg}` }; // Set flag to 0 for error
            }
         }
      }
      else if (mode === 'excel') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
         let excelOutput = `Simulating Excel: ${commandTrimmed} (output placeholder)`;
         let excelLogType: 'I' | 'E' = 'I';
         let outputTypeExcel: OutputLine['type'] = 'output';
         let logFlag: 0 | 1 = 0; // Add flag
         if (commandLower.startsWith('sum(')) {
             const numbersMatch = commandTrimmed.match(/sum\(([\d\s,.]+)\)/i);
             if (numbersMatch && numbersMatch[1]) {
                 try {
                     const numbers = numbersMatch[1].split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                     const sum = numbers.reduce((acc, val) => acc + val, 0);
                     excelOutput = `${sum}`;
                     outputTypeExcel = 'output';
                 } catch (e) {
                     excelOutput = '#VALUE!';
                     excelLogType = 'E';
                     outputTypeExcel = 'error';
                     logFlag = 0; // Set flag to 0 for error
                 }
             } else {
                  excelOutput = '#NAME?';
                  excelLogType = 'E';
                  outputTypeExcel = 'error';
                  logFlag = 0; // Set flag to 0 for error
             }
         }
         outputLines = [{ id: `out-${timestamp}`, text: excelOutput, type: outputTypeExcel, category: 'excel', timestamp: outputTypeExcel === 'error' ? timestamp : undefined, flag: logFlag }]; // Add flag
         logEntry = { timestamp, type: excelLogType, flag: logFlag, text: `Excel simulation output: ${excelOutput}` };
      }
      else if (mode === 'typescript') {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 50));
        let simOutput = `Simulating TypeScript: ${commandTrimmed} (output placeholder)`;
        let tsLogType: 'I' | 'E' = 'I';
        let tsOutputType: 'output' | 'error' = 'output';
        let tsLogFlag: 0 | 1 = 0;

        if (commandLower.startsWith('console.log(')) {
            const matchConsoleLog = commandTrimmed.match(/console\.log\((['"]?)(.*?)\1\)/);
            simOutput = matchConsoleLog ? `Output: ${matchConsoleLog[2]}` : 'Syntax Error in console.log';
            tsOutputType = matchConsoleLog ? 'output' : 'error';
            if (!matchConsoleLog) {
                 tsLogType = 'E';
                 tsLogFlag = 0;
            }
        } else if (commandLower.includes('=')) { // Very basic check for assignment
            simOutput = `Simulating TypeScript: ${commandTrimmed} (Variable notionally assigned)`;
        } else if (commandLower.startsWith('type ') || commandLower.startsWith('interface ')) {
            simOutput = `Simulating TypeScript: ${commandTrimmed} (Type/Interface notionally defined)`;
        }
        outputLines = [{ id: `out-${timestamp}`, text: simOutput, type: tsOutputType, category: 'typescript', timestamp: tsOutputType === 'error' ? timestamp : undefined, flag: tsLogFlag }];
        logEntry = { timestamp, type: tsLogType, flag: tsLogFlag, text: `TypeScript simulation: ${simOutput}` };
      }
       else {
         const errorMsg = `Error: Command execution logic not implemented for category '${mode}'.`;
         outputLines = [{ id: `err-unknown-mode-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }]; // Set flag to 0 for error
         logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
       }

  } catch (error) // Catch errors from handlers themselves or permission denials
  { // Added parameter 'error' with type 'any' for better error handling
      console.error("Unhandled error during command execution:", error);
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      outputLines = [{ id: `fatal-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 }]; // Set flag to 0 for error
      logEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag to 0 for error
  }


  // Combine logs if a new entry was created outside internal handlers
  let finalLogEntries = potentiallyUpdatedLogs;
  // If potentiallyUpdatedLogs is undefined, it means no new logs were created by internal handlers or explicitly set.
  if (!finalLogEntries) {
      finalLogEntries = logEntry ? [...currentLogEntries, logEntry] : currentLogEntries;
  }

  // Return the result object
  // Always include the command itself in the output
  return {
    outputLines: [commandOutput, ...outputLines],
    newLogEntries: finalLogEntries, // Return updated logs if they changed
    newSuggestions: internalResult.newSuggestions, // Return new suggestions data
    newCustomCommands: internalResult.newCustomCommands, // Return new custom commands data
    toastInfo: toastInfoFromResult, // Propagate toast info
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
