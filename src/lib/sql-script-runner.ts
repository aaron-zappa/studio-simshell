// src/lib/sql-script-runner.ts
// src/lib/sql-script-runner.ts
'use server';

import * as fs from 'fs/promises';
import * as _path from 'path'; // Use _path to avoid conflict with any path variable
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { runSql } from '@/lib/database';
import { formatResultsAsTable } from '@/lib/formatting';

interface ExecuteSqlScriptResult {
  outputLines: OutputLine[];
  newLogEntries?: LogEntry[];
  error?: string;
}

const SQL_SCRIPTS_DIR = _path.join(process.cwd(), 'src', 'sql-scripts');

/**
 * Reads an SQL script file, parses its commands, and executes them sequentially.
 * @param filename - The name of the SQL script file (e.g., 'list_all_tables.sql').
 * @returns A promise that resolves to an object containing output lines and log entries.
 */
export async function executeSqlScript(filename: string): Promise<ExecuteSqlScriptResult> {
  const timestamp = new Date().toISOString();
  let outputLines: OutputLine[] = [];
  let logEntries: LogEntry[] = [];

  // --- Security Check: Validate filename and construct path ---
  if (!filename.match(/^[a-zA-Z0-9_.-]+\.sql$/) || filename.includes('..') || filename.includes('/')) {
    const errorMsg = `Error: Invalid SQL script filename '${filename}'.`;
    logEntries.push({ timestamp, type: 'E', flag: 1, text: errorMsg }); // Error flag
    return {
      outputLines: [{ id: `sql-script-invalid-name-${timestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp, flag: 1 }], // Error flag
      newLogEntries: logEntries,
      error: errorMsg,
    };
  }

  const filePath = _path.join(SQL_SCRIPTS_DIR, filename);

  // Ensure the resolved path is actually within the allowed directory
  if (!_path.resolve(filePath).startsWith(_path.resolve(SQL_SCRIPTS_DIR))) {
    const errorMsg = `Error: Access denied for SQL script path '${filename}'.`;
     logEntries.push({ timestamp, type: 'E', flag: 1, text: errorMsg }); // Error flag
    return {
      outputLines: [{ id: `sql-script-access-denied-${timestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp, flag: 1 }], // Error flag
      newLogEntries: logEntries,
      error: errorMsg,
    };
  }
  // --- End Security Check ---

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Basic SQL command splitting (assumes commands are separated by ';')
    // This may need to be more robust for complex SQL with semicolons in strings/comments.
    const commands = fileContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    if (commands.length === 0) {
      const infoMsg = `SQL script '${filename}' is empty or contains no valid commands.`;
      outputLines.push({ id: `sql-script-empty-${timestamp}`, text: infoMsg, type: 'info', category: 'sql', timestamp, flag: 0 });
      logEntries.push({ timestamp, type: 'I', flag: 0, text: infoMsg });
      return { outputLines, newLogEntries: logEntries };
    }
    
    outputLines.push({ id: `sql-script-start-${timestamp}`, text: `Executing SQL script: ${filename}`, type: 'info', category: 'sql', timestamp, flag: 0 });
    logEntries.push({ timestamp, type: 'I', flag: 0, text: `Started executing SQL script: ${filename}` });


    for (let i = 0; i < commands.length; i++) {
      const commandText = commands[i];
      const cmdTimestamp = new Date().toISOString();
      
      // Add the command itself to outputLines
      outputLines.push({
        id: `sql-script-cmd-${i}-${cmdTimestamp}`,
        text: commandText,
        type: 'command',
        category: 'sql',
        timestamp: cmdTimestamp,
      });

      try {
        const { results, changes, lastInsertRowid } = await runSql(commandText);
        let commandLogText = `SQL script '${filename}', command ${i + 1}/${commands.length}: ${commandText}`;

        if (results) {
          const formattedTable = await formatResultsAsTable(results);
          const resultOutput = formattedTable || '(0 rows)';
          outputLines.push({ id: `sql-script-res-${i}-${cmdTimestamp}`, text: resultOutput, type: 'output', category: 'sql', timestamp: undefined });
          commandLogText += ` | Result: ${results.length} row(s).`;
        } else if (changes !== null) {
          let infoText = `Query executed successfully. ${changes} row${changes === 1 ? '' : 's'} affected.`;
          if (lastInsertRowid !== null && lastInsertRowid > 0) {
            infoText += ` Last inserted row ID: ${lastInsertRowid}`;
          }
          outputLines.push({ id: `sql-script-info-${i}-${cmdTimestamp}`, text: infoText, type: 'info', category: 'sql', timestamp: cmdTimestamp, flag: 0 });
           commandLogText += ` | Info: ${infoText}`;
        } else {
          const successMsg = "Query executed successfully.";
          outputLines.push({ id: `sql-script-ok-${i}-${cmdTimestamp}`, text: successMsg, type: 'info', category: 'sql', timestamp: cmdTimestamp, flag: 0 });
           commandLogText += ` | Info: ${successMsg}`;
        }
        logEntries.push({ timestamp: cmdTimestamp, type: 'I', flag: 0, text: commandLogText });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown SQL execution error';
        const detailedError = `Error in SQL script '${filename}', command ${i + 1} ('${commandText.substring(0,50)}...'): ${errorMsg}`;
        outputLines.push({ id: `sql-script-err-${i}-${cmdTimestamp}`, text: detailedError, type: 'error', category: 'sql', timestamp: cmdTimestamp, flag: 1 }); // Error flag
        logEntries.push({ timestamp: cmdTimestamp, type: 'E', flag: 1, text: detailedError }); // Error flag
        // Optionally, decide if script execution should stop on error
        // For now, it continues to the next command.
      }
    }
    logEntries.push({ timestamp: new Date().toISOString(), type: 'I', flag: 0, text: `Finished executing SQL script: ${filename}` });

  } catch (error) {
    const errorMsg = `Error processing SQL script '${filename}': ${error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'File not found.' : (error instanceof Error ? error.message : 'Unknown error')}`;
    outputLines.push({ id: `sql-script-proc-err-${timestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp, flag: 1 }); // Error flag
    logEntries.push({ timestamp, type: 'E', flag: 1, text: errorMsg }); // Error flag
    return { outputLines, newLogEntries: logEntries, error: errorMsg };
  }

  return { outputLines, newLogEntries: logEntries };
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'sql-script-runner.ts';
}

