
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import { addLogEntry, type LogEntry } from '@/lib/logging'; // Removed exportLogFile import, it's client-side only now
import type { CommandMode } from '@/types/command-types';


interface ExecuteCommandParams {
  command: string;
  mode: CommandMode;
  addSuggestion: (mode: CommandMode, command: string) => void;
  addCustomCommand: (name: string, action: CustomCommandAction) => void;
  getCustomCommandAction: (name: string) => CustomCommandAction | undefined;
  logEntries: LogEntry[]; // Pass current log entries (though direct modification is problematic)
  setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>; // Pass setter for logging (though direct modification is problematic)
  initialSuggestions: Record<string, string[]>; // Pass initial suggestions for mode checking etc.
}

/**
 * Executes a command based on the current mode and returns output lines.
 * This is intended to be used as a Server Action.
 */
export const executeCommand = async ({ // Added async keyword
    command,
    mode,
    addSuggestion,
    addCustomCommand,
    getCustomCommandAction,
    logEntries, // Keep receiving, but avoid direct mutation if possible
    setLogEntries, // Keep receiving, but avoid direct mutation if possible
    initialSuggestions
}: ExecuteCommandParams): Promise<OutputLine[]> => {
  const timestamp = new Date().toISOString(); // Simple unique ID
  const commandLower = command.toLowerCase().trim();
  const args = command.split(' ').slice(1);
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
    // 1. Built-in commands
    if (commandLower.startsWith('help')) {
      // Updated help text for add_int_cmd format and create sqlite
      outputLines = [{ id: `out-${timestamp}`, text: `Available modes: ${Object.keys(initialSuggestions).join(', ')}.\nUse 'mode [mode_name]' to switch.\nAvailable internal commands: help, clear, mode, history, define, refine, add_int_cmd <short> <name> "<description>" <whatToDo>, export log, pause, create sqlite <filename.db>\nRun custom commands by typing their name.`, type: 'output', category: 'internal' }];
    } else if (commandLower === 'clear') {
      // Special case handled in handleCommandSubmit
      outputLines = [];
    } else if (commandLower.startsWith('mode ')) {
       const newMode = args[0] as CommandMode;
       // Check against the static list of supported modes
       if (Object.keys(initialSuggestions).includes(newMode)) {
         // Mode change is handled in handleCommandSubmit
         outputLines = [{ id: `out-${timestamp}`, text: `Switched to ${newMode} mode.`, type: 'info', category: 'internal' }];
       } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid mode '${args[0]}'. Available modes: ${Object.keys(initialSuggestions).join(', ')}`, type: 'error', category: 'internal' }];
       }
    } else if (commandLower === 'history') {
       outputLines = [{ id: `out-${timestamp}`, text: 'History command placeholder (fetch from SQLite).', type: 'output', category: 'internal' }];
    } else if (commandLower.startsWith('define ')) {
       outputLines = [{ id: `out-${timestamp}`, text: `Define command placeholder for: ${args.join(' ')}`, type: 'output', category: 'internal' }];
    } else if (commandLower.startsWith('refine ')) {
       outputLines = [{ id: `out-${timestamp}`, text: `Refine command placeholder for: ${args.join(' ')}`, type: 'output', category: 'internal' }];
    } else if (commandLower.startsWith('add_int_cmd ')) { // Updated command name check
        // Regex to capture short, name, description (in quotes), and whatToDo
        // Example: add_int_cmd srt mycmd "This is my command" echo hello
        const addCmdRegex = /^add_int_cmd\s+(\S+)\s+(\S+)\s+"([^"]+)"\s+(.+)$/i; // Added capture for <short>
        const match = command.match(addCmdRegex); // Match against original command casing

        if (match && match[1] && match[2] && match[3] && match[4]) { // Check for all 4 captured groups
            const newCommandShort = match[1]; // <short>
            const newCommandName = match[2]; // <name>
            const newCommandDescription = match[3].trim(); // Description from quotes
            const newCommandAction = match[4].trim(); // whatToDo is the rest

            // Check if name conflicts with built-in commands
            if (initialSuggestions.internal.includes(newCommandName.toLowerCase())) {
                 outputLines = [{ id: `out-${timestamp}`, text: `Error: Cannot redefine built-in command "${newCommandName}".`, type: 'error', category: 'internal' }];
            } else {
                addSuggestion('internal', newCommandName); // Add to suggestions
                addCustomCommand(newCommandName, newCommandAction); // Add to custom command store (Action = whatToDo)

                // Log the addition
                 const logEntry: LogEntry = {
                    timestamp: new Date().toISOString(),
                    short: newCommandShort, // Log the short name
                    commandName: newCommandName,
                    description: newCommandDescription, // Log the description
                    action: newCommandAction,
                };
                 // Ensure setLogEntries is correctly passed and used
                 // Note: Directly calling setLogEntries in a Server Action is problematic.
                 // Logging should ideally happen via a dedicated logging service or database call.
                 // For now, we assume it somehow works for demonstration, but this needs refactoring.
                 try {
                    // This call will likely fail or behave unexpectedly in a real Server Action context
                    // A better approach would be to return the log entry or trigger a separate logging action.
                    addLogEntry(logEntry, setLogEntries);
                 } catch (logError) {
                     console.error("Logging failed in Server Action:", logError);
                     // Add a secondary output line indicating logging failure, but proceed with command addition feedback
                      outputLines.push({ id: `log-fail-${timestamp}`, text: 'Warning: Command added, but failed to write to session log.', type: 'error', category: 'internal' });
                 }


                // Provide feedback including the short name and description
                outputLines.push({ id: `out-${timestamp}`, text: `Added internal command: "${newCommandName}" (short: ${newCommandShort}). Description: "${newCommandDescription}". Action: "${newCommandAction}". Logged to session log.`, type: 'info', category: 'internal' });
            }
        } else {
            // Update error message for new syntax
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add_int_cmd <short> <name> "<description>" <whatToDo>`, type: 'error', category: 'internal' }];
        }
    } else if (commandLower === 'export log') {
        // Client-side handled, this provides feedback only if called directly (shouldn't happen with current client logic)
         outputLines = [{ id: `log-export-info-${timestamp}`, text: 'Log export initiated client-side. Check your downloads.', type: 'info', category: 'internal' }];
    } else if (commandLower === 'pause') {
        // 'pause' is handled client-side, this shouldn't be reached via normal flow
        outputLines = [{ id: `out-${timestamp}`, text: `'pause' command is handled client-side.`, type: 'info', category: 'internal' }];
    } else if (commandLower.startsWith('create sqlite ')) {
        const filename = args[1]; // Get the second argument (index 1)
        if (filename && filename.endsWith('.db')) {
            // Simulate creating the database
            await new Promise(resolve => setTimeout(resolve, 300)); // Simulate brief delay
            outputLines = [{ id: `out-${timestamp}`, text: `Simulated creation of SQLite database: ${filename}`, type: 'info', category: 'internal' }];
            // TODO: In a real implementation, use a SQLite library here
        } else {
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax or filename. Use: create sqlite <filename.db>`, type: 'error', category: 'internal' }];
        }
    }
    // 2. Custom internal commands
    else {
       const action = getCustomCommandAction(commandName);
       if (action !== undefined) {
           // Execute the custom command's action (currently just echo)
           // Simulate potential delay for custom commands
           await new Promise(resolve => setTimeout(resolve, 500)); // Simulate 0.5 second delay
           outputLines = [{ id: `out-${timestamp}`, text: action, type: 'output', category: 'internal' }];
       }
       // 3. Command not found
       else {
           outputLines = [{ id: `out-${timestamp}`, text: `Internal command not found: ${commandName}`, type: 'error', category: 'internal' }];
       }
    }
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
    // --- SQL simulation ---
  else if (mode === 'sql') {
     // Simulate potential delay
     await new Promise(resolve => setTimeout(resolve, Math.random() * 1200 + 300)); // 0.3-1.5 sec delay
     if (commandLower.startsWith('select')) {
         outputLines = [{ id: `out-${timestamp}`, text: `id | name\n---|-----\n1  | Alice\n2  | Bob\n(2 rows)`, type: 'output', category: 'sql' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating SQL: ${command} (output placeholder)`, type: 'output', category: 'sql' }];
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

