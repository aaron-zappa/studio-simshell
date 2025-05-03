
'use server';

import type { CustomCommandAction } from '@/hooks/use-custom-commands';
import type { OutputLine } from '@/components/output-display';
import { addLogEntry, exportLogFile, type LogEntry } from '@/lib/logging';
import type { CommandMode } from '@/types/command-types';


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
 * This is intended to be used as a Server Action.
 */
export const executeCommand = async ({ // Added async keyword
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
      outputLines = [{ id: `out-${timestamp}`, text: `Available modes: internal, python, unix, windows, sql.\nUse 'mode [mode_name]' to switch.\nAvailable internal commands: help, clear, mode, history, define, refine, add_int_cmd <name> "<description>" <whatToDo>, export log\nRun custom commands by typing their name.`, type: 'output', category: 'internal' }];
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
    } else if (commandLower.startsWith('add_int_cmd ')) { // Updated command name
        // Regex to capture name, description (in quotes), and whatToDo
        // Example: add_int_cmd mycmd "This is my command" echo hello
        const addCmdRegex = /^add_int_cmd (\S+)\s+"([^"]+)"\s+(.+)$/i; // Updated regex
        const match = command.match(addCmdRegex); // Match against original command casing

        if (match && match[1] && match[2] && match[3]) {
            const newCommandName = match[1];
            const newCommandDescription = match[2].trim(); // Description from quotes
            const newCommandAction = match[3].trim(); // whatToDo is the rest

            // Check if name conflicts with built-in commands
            if (initialSuggestions.internal.includes(newCommandName.toLowerCase())) {
                 outputLines = [{ id: `out-${timestamp}`, text: `Error: Cannot redefine built-in command "${newCommandName}".`, type: 'error', category: 'internal' }];
            } else {
                addSuggestion('internal', newCommandName); // Add to suggestions
                addCustomCommand(newCommandName, newCommandAction); // Add to custom command store (Action = whatToDo)

                // Log the addition
                 const logEntry: LogEntry = {
                    timestamp: new Date().toISOString(),
                    commandName: newCommandName,
                    description: newCommandDescription, // Log the description
                    action: newCommandAction,
                };
                addLogEntry(logEntry, setLogEntries); // Use the passed setter

                // Provide feedback including the description
                outputLines = [{ id: `out-${timestamp}`, text: `Added internal command: "${newCommandName}". Description: "${newCommandDescription}". Action: "${newCommandAction}". Logged to session log.`, type: 'info', category: 'internal' }];
            }
        } else {
            // Update error message for new syntax
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add_int_cmd <name> "<description>" <whatToDo>`, type: 'error', category: 'internal' }];
        }
    } else if (commandLower === 'export log') {
        // Client-side handled, this provides feedback
         outputLines = [{ id: `log-export-info-${timestamp}`, text: 'Log export initiated client-side. Check your downloads.', type: 'info', category: 'internal' }];
    }
    // 2. Custom internal commands
    else {
       const action = getCustomCommandAction(commandName);
       if (action !== undefined) {
           // Execute the custom command's action (currently just echo)
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
     if (commandLower.startsWith('print(')) {
        const match = command.match(/print\((['"])(.*?)\1\)/);
        outputLines = [{ id: `out-${timestamp}`, text: match ? match[2] : 'Syntax Error in print', type: match ? 'output' : 'error', category: 'python' }];
     } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Simulating Python: ${command} (output placeholder)`, type: 'output', category: 'python' }];
     }
  }
   // --- Unix simulation ---
  else if (mode === 'unix') {
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
     if (commandLower.startsWith('select')) {
         outputLines = [{ id: `out-${timestamp}`, text: `id | name\n---|-----\n1  | Alice\n2  | Bob\n(2 rows)`, type: 'output', category: 'sql' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating SQL: ${command} (output placeholder)`, type: 'output', category: 'sql' }];
     }
  }

  return [commandOutput, ...outputLines];
};
