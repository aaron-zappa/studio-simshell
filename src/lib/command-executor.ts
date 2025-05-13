// src/lib/command-executor.ts
// src/lib/command-executor.ts
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';
import { formatResultsAsTable } from '@/lib/formatting';
import { handleInternalCommand, type HandlerResult as InternalHandlerResult } from '@/lib/internal-commands'; // Import the central internal command handler
import { storeVariableInDb } from '@/lib/variables';
import { getUserPermissions } from '@/lib/permissions';
import type { LogEntry } from '@/types/log-types';

interface ExecuteCommandParams {
  userId: number;
  command: string;
  mode: CommandMode;
  currentLogEntries: LogEntry[];
  initialSuggestions: Record<string, string[]>;
  // Removed client-side setters from params as they don't work in Server Actions
  // addSuggestion: (mode: CommandMode, command: string) => void;
  // addCustomCommand: (name: string, action: CustomCommandAction) => void;
  getCustomCommandAction: (name: string) => CustomCommandAction | undefined; // Keep if needed for custom command logic
  overridePermissionChecks?: boolean; // Added for permission override
}

// Define the return type to include potentially updated log entries and toast info
export interface ExecuteCommandResult {
  outputLines: OutputLine[];
  newSuggestions?: { mode: CommandMode; command: string }[];
  newCustomCommands?: { name: string; action: CustomCommandAction }[];
  newLogEntries?: LogEntry[];
  toastInfo?: { message: string; variant?: 'default' | 'destructive' };
}

/**
 * Executes a command based on the *classified mode/category* and returns output lines.
 * Fetches user permissions and potentially modifies AI behavior based on them.
 * Delegates internal command handling to a separate module.
 * Handles variable assignments if classified as 'internal'.
 * This is intended to be used as a Server Action.
 */
export async function executeCommand ({
    userId,
    command,
    mode,
    currentLogEntries,
    initialSuggestions,
    getCustomCommandAction, // Keep if custom commands are handled here or passed down
    overridePermissionChecks = false // Default to false
}: ExecuteCommandParams): Promise<ExecuteCommandResult> {
  console.log(`[executeCommand] Received command: "${command}", Mode: "${mode}", User ID: ${userId}`);

  const timestamp = new Date().toISOString();
  const commandTrimmed = command.trim();
  const commandLower = commandTrimmed.toLowerCase();

  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command,
    type: 'command',
    category: mode,
    timestamp: timestamp,
  };

  let outputLines: OutputLine[] = [];
  let potentiallyUpdatedLogs: LogEntry[] | undefined = undefined;
  let logEntryToAdd: LogEntry | null = null;

  // Initialize return fields
  let newSuggestionsResult: ExecuteCommandResult['newSuggestions'];
  let newCustomCommandsResult: ExecuteCommandResult['newCustomCommands'];
  let toastInfoResult: ExecuteCommandResult['toastInfo'];


  if (overridePermissionChecks) {
    const warningMsg = `WARNING: All permission checks are currently bypassed for user ${userId}.`;
    logEntryToAdd = { timestamp, type: 'W', flag: 1, text: warningMsg };
    outputLines.push({ id: `perm-override-warn-${timestamp}`, text: warningMsg, type: 'warning', category: 'internal', timestamp, flag: 1 });
    potentiallyUpdatedLogs = logEntryToAdd ? [...currentLogEntries, logEntryToAdd] : [...currentLogEntries];
  }


  // --- Fetch User Permissions ---
  // This part might be redundant if overridePermissionChecks is true and handled above,
  // but keeping it for structure. The actual check logic inside handlers will use overridePermissionChecks.
  let userPermissions: string[] = [];
  if (!overridePermissionChecks) {
      if (commandLower !== 'help' && commandLower !== 'init db') { // Allow help/init db before full permission setup
          const permResult = await getUserPermissions(userId);
          if (Array.isArray(permResult)) {
              userPermissions = permResult;
          } else {
               const errorMsg = permResult.code === 'DB_NOT_INITIALIZED'
                    ? "Permission check skipped: Database RBAC tables not initialized. Please run 'init db'."
                    : `Error fetching user permissions: ${permResult.error}`;
               outputLines.push({ id: `perm-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 });
               const permErrorLog: LogEntry = { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User ID: ${userId})` };
               return {
                   outputLines: [commandOutput, ...outputLines],
                   newLogEntries: potentiallyUpdatedLogs ? [...potentiallyUpdatedLogs, permErrorLog] : [...currentLogEntries, permErrorLog],
                   newSuggestions: newSuggestionsResult,
                   newCustomCommands: newCustomCommandsResult,
                   toastInfo: toastInfoResult
               };
          }
      }
  } else {
      userPermissions = ['override_all_permissions']; // Dummy permission for override
  }


  try {
      const assignmentRegex = /^\s*([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/;
      const assignmentMatch = commandTrimmed.match(assignmentRegex);

      if (mode === 'internal') {
        const internalResult: InternalHandlerResult = await handleInternalCommand({
            userId,
            userPermissions,
            command: commandTrimmed,
            commandLower,
            commandName: commandLower.split(' ')[0],
            args: commandTrimmed.split(' ').slice(1),
            timestamp,
            addSuggestion: () => {}, // Placeholder, server actions cannot call client hooks directly
            addCustomCommand: () => {}, // Placeholder
            getCustomCommandAction,
            currentLogEntries: potentiallyUpdatedLogs || currentLogEntries,
            initialSuggestions,
            overridePermissionChecks
        });
        outputLines = [...outputLines, ...internalResult.outputLines];
        potentiallyUpdatedLogs = internalResult.newLogEntries;
        toastInfoResult = internalResult.toastInfo;
        newSuggestionsResult = internalResult.newSuggestions;
        newCustomCommandsResult = internalResult.newCustomCommands;
      }
      else if (assignmentMatch && (mode === 'internal' || mode === 'python')) {
          // Variable assignment logic for internal or python (if not handled by internal command)
          if (!overridePermissionChecks && !userPermissions.includes('manage_variables')) {
              const errorMsg = "Permission denied: Cannot manage variables.";
              throw new Error(errorMsg);
          }
          const variableName = assignmentMatch[1];
          const valueString = assignmentMatch[2].trim();
          let dataType = 'unknown';
          let actualValue: any = valueString;

          if (/^\d+$/.test(valueString)) { dataType = 'integer'; actualValue = parseInt(valueString, 10); }
          else if (/^\d+\.\d+$/.test(valueString)) { dataType = 'real'; actualValue = parseFloat(valueString); }
          else if (valueString === 'True' || valueString === 'False') { dataType = 'boolean'; actualValue = valueString === 'True'; }
          else if ((valueString.startsWith('"') && valueString.endsWith('"')) || (valueString.startsWith("'") && valueString.endsWith("'"))) { dataType = 'string'; actualValue = valueString.slice(1, -1); }
          else if (mode === 'python' && valueString.toLowerCase() === 'none') { dataType = 'none'; actualValue = null; }
          else { dataType = 'string'; actualValue = valueString; }

          await storeVariableInDb(variableName, String(actualValue), dataType);
          logEntryToAdd = { timestamp, type: 'I', flag: 0, text: `Stored/Updated ${mode} variable '${variableName}' type '${dataType}' value: ${String(actualValue)} (User: ${userId})` };
          // No direct output for assignment typically
      }
      else if (mode === 'python') {
         if (commandLower.startsWith('print(')) {
            const matchPrint = commandTrimmed.match(/print\((['"]?)(.*?)\1\)/);
            const printOutput = matchPrint ? matchPrint[2] : 'Syntax Error in print';
            const type: OutputLine['type'] = matchPrint ? 'output' : 'error';
            outputLines.push({ id: `out-${timestamp}`, text: printOutput, type: type, category: 'python', timestamp: type === 'error' ? timestamp : undefined, flag: 0 });
            logEntryToAdd = { timestamp, type: matchPrint ? 'I' : 'E', flag: 0, text: `Python print: ${printOutput} (User: ${userId})` };
         } else {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
            const simOutput = `Simulating Python: ${commandTrimmed} (output placeholder)`;
            outputLines.push({ id: `out-${timestamp}`, text: simOutput, type: 'output', category: 'python', timestamp: undefined, flag: 0 });
            logEntryToAdd = { timestamp, type: 'I', flag: 0, text: `${simOutput} (User: ${userId})` };
         }
      }
      else if (mode === 'unix' || mode === 'windows') {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 100));
        let simOutput = `Simulating ${mode}: ${commandTrimmed} (output placeholder)`;
        if (commandLower === 'ls' && mode === 'unix') simOutput = 'file1.txt  directoryA  script.sh';
        else if (commandLower === 'dir' && mode === 'windows') simOutput = ' Volume in drive C ...\nfile1.txt ...';
        else if (commandLower.startsWith('echo ')) simOutput = commandTrimmed.substring(5);
        outputLines.push({ id: `out-${timestamp}`, text: simOutput, type: 'output', category: mode, timestamp: undefined, flag: 0 });
        logEntryToAdd = { timestamp, type: 'I', flag: 0, text: `${mode} simulation output: ${simOutput} (User: ${userId})` };
      }
      else if (mode === 'sql') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
         try {
           const isSelectQuery = commandTrimmed.trim().toUpperCase().startsWith('SELECT');
           if (!overridePermissionChecks && isSelectQuery && !userPermissions.includes('execute_sql_select')) throw new Error("Permission denied: Cannot execute SELECT queries.");
           if (!overridePermissionChecks && !isSelectQuery && !userPermissions.includes('execute_sql_modify')) throw new Error("Permission denied: Cannot execute modifying SQL queries.");

           const { results, changes, lastInsertRowid } = await runSql(commandTrimmed);
           let sqlLogText: string;
           if (results) {
             const formattedTable = await formatResultsAsTable(results);
             const sqlOutput = formattedTable || "Query executed successfully, no results returned.";
             outputLines.push({ id: `out-${timestamp}`, text: sqlOutput, type: 'output', category: 'sql', timestamp: undefined, flag: 0 });
             sqlLogText = `SQL query result: ${results.length} row(s). (User: ${userId})`;
           } else if (changes !== null) {
             let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
             if (lastInsertRowid !== null && lastInsertRowid > 0) infoText += ` Last inserted row ID: ${lastInsertRowid}`;
             outputLines.push({ id: `out-${timestamp}`, text: infoText, type: 'info', category: 'sql', timestamp, flag: 0 });
             sqlLogText = `SQL info: ${infoText} (User: ${userId})`;
           } else {
              const successMsg = "Query executed successfully.";
              outputLines.push({ id: `out-${timestamp}`, text: successMsg, type: 'info', category: 'sql', timestamp, flag: 0 });
              sqlLogText = `${successMsg} (User: ${userId})`;
           }
           logEntryToAdd = { timestamp, type: 'I', flag: 0, text: sqlLogText };
         } catch (error) {
           const errorMsg = error instanceof Error ? error.message : 'Unknown SQL execution error';
           const displayError = errorMsg.includes('no such table') ? `${errorMsg}. Consider running 'init db'.` : errorMsg;
           outputLines.push({ id: `err-${timestamp}`, text: displayError, type: 'error', category: 'sql', timestamp, flag: 0 });
           logEntryToAdd = { timestamp, type: 'E', flag: 0, text: `SQL Error: ${displayError} (User: ${userId})` };
         }
      }
      else if (mode === 'excel') {
         await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
         let excelOutput = `Simulating Excel: ${commandTrimmed} (output placeholder)`;
         let excelLogType: 'I' | 'E' = 'I'; let outputTypeExcel: OutputLine['type'] = 'output'; let logFlagExcel: 0 | 1 = 0;
         if (commandLower.startsWith('sum(')) {
             const numbersMatch = commandTrimmed.match(/sum\(([\d\s,.]+)\)/i);
             if (numbersMatch && numbersMatch[1]) {
                 try {
                     const numbers = numbersMatch[1].split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                     excelOutput = `${numbers.reduce((acc, val) => acc + val, 0)}`;
                 } catch (e) { excelOutput = '#VALUE!'; excelLogType = 'E'; outputTypeExcel = 'error'; logFlagExcel = 0; }
             } else { excelOutput = '#NAME?'; excelLogType = 'E'; outputTypeExcel = 'error'; logFlagExcel = 0; }
         }
         outputLines.push({ id: `out-${timestamp}`, text: excelOutput, type: outputTypeExcel, category: 'excel', timestamp: outputTypeExcel === 'error' ? timestamp : undefined, flag: logFlagExcel });
         logEntryToAdd = { timestamp, type: excelLogType, flag: logFlagExcel, text: `Excel simulation: ${excelOutput} (User: ${userId})` };
      }
      else if (mode === 'typescript') {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 50));
        let simOutput = `Simulating TypeScript: ${commandTrimmed} (output placeholder)`;
        let tsLogType: 'I' | 'E' = 'I'; let tsOutputType: 'output' | 'error' = 'output'; let tsLogFlag: 0 | 1 = 0;
        if (commandLower.startsWith('console.log(')) {
            const matchConsoleLog = commandTrimmed.match(/console\.log\((['"]?)(.*?)\1\)/);
            simOutput = matchConsoleLog ? `Output: ${matchConsoleLog[2]}` : 'Syntax Error in console.log';
            tsOutputType = matchConsoleLog ? 'output' : 'error'; if (!matchConsoleLog) { tsLogType = 'E'; tsLogFlag = 0; }
        } else if (commandLower.includes('=')) simOutput = `Simulating TypeScript: ${commandTrimmed} (Variable notionally assigned)`;
        else if (commandLower.startsWith('type ') || commandLower.startsWith('interface ')) simOutput = `Simulating TypeScript: ${commandTrimmed} (Type/Interface notionally defined)`;
        outputLines.push({ id: `out-${timestamp}`, text: simOutput, type: tsOutputType, category: 'typescript', timestamp: tsOutputType === 'error' ? timestamp : undefined, flag: tsLogFlag });
        logEntryToAdd = { timestamp, type: tsLogType, flag: tsLogFlag, text: `TypeScript simulation: ${simOutput} (User: ${userId})` };
      }
      // Removed the 'else' that caused "Command not recognized" for unhandled modes, as classification should handle this.
      // If classification fails or a mode isn't handled above, outputLines will remain empty from this block.

  } catch (error) {
      console.error("Unhandled error during command execution:", error);
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      outputLines.push({ id: `fatal-err-${timestamp}`, text: errorMsg, type: 'error', category: 'internal', timestamp, flag: 0 });
      logEntryToAdd = { timestamp, type: 'E', flag: 0, text: `${errorMsg} (User: ${userId})` };
  }


  let finalLogEntries = potentiallyUpdatedLogs ? [...potentiallyUpdatedLogs] : [...currentLogEntries];
  if (logEntryToAdd && !(potentiallyUpdatedLogs && potentiallyUpdatedLogs.includes(logEntryToAdd))) {
      finalLogEntries.push(logEntryToAdd);
  }


  return {
    outputLines: [commandOutput, ...outputLines],
    newLogEntries: finalLogEntries,
    newSuggestions: newSuggestionsResult,
    newCustomCommands: newCustomCommandsResult,
    toastInfo: toastInfoResult,
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
