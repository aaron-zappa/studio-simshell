
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
  setLogEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>; // Pass setter for logging - Note: Direct state mutation from Server Action is complex.
  initialSuggestions: Record<string, string[]>; // Pass initial suggestions for mode checking etc.
}

/**
 * Executes a command based on the current mode and returns output lines.
 * This is intended to be used as a Server Action.
 */
export const executeCommand = async ({
    command,
    mode,
    addSuggestion,
    addCustomCommand,
    getCustomCommandAction,
    logEntries,
    setLogEntries, // Be cautious using state setters directly in Server Actions
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
      outputLines = [{ id: `out-${timestamp}`, text: `Available modes: internal, python, unix, windows, sql.\nUse 'mode [mode_name]' to switch.\nAvailable internal commands: help, clear, mode, history, define, refine, add int_cmd <name> <description_and_action>, export log\nRun custom commands by typing their name.`, type: 'output', category: 'internal' }];
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
    // } else if (commandLower.startsWith('add internal command ')) { // OLD SYNTAX
    } else if (commandLower.startsWith('add int_cmd ')) { // NEW SYNTAX
        // Regex to capture command name and the rest as action/description
        const addCmdRegex = /^add int_cmd (\S+)\s+(.+)$/i; // <name> <description_and_action>
        const match = command.match(addCmdRegex); // Match against original command casing

        if (match && match[1] && match[2]) {
            const newCommandName = match[1]; // Keep original casing for display if needed, but store lowercase
            const newCommandAction = match[2].trim(); // Action is the rest of the string

            // Check if name conflicts with built-in commands (use lowercase for comparison)
            if (initialSuggestions.internal.includes(newCommandName.toLowerCase()) || newCommandName.toLowerCase() === 'add int_cmd') {
                 outputLines = [{ id: `out-${timestamp}`, text: `Error: Cannot redefine built-in command "${newCommandName}".`, type: 'error', category: 'internal' }];
            } else {
                addSuggestion('internal', newCommandName); // Add to suggestions
                addCustomCommand(newCommandName, newCommandAction); // Add to custom command store

                // Log the addition
                 const logEntry: LogEntry = {
                    timestamp: new Date().toISOString(),
                    commandName: newCommandName,
                    action: newCommandAction,
                };
                // Use the passed setter - This might cause issues in Server Actions if setLogEntries modifies client state directly
                // Consider returning the new log entry or handling state update differently on client.
                addLogEntry(logEntry, setLogEntries);

                // Provide feedback
                outputLines = [{ id: `out-${timestamp}`, text: `Added internal command: "${newCommandName}". Action: "${newCommandAction}". Logged to session log.`, type: 'info', category: 'internal' }];
            }
        } else {
            // Update error message for new syntax
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add int_cmd <command_name> <description_and_action>`, type: 'error', category: 'internal' }];
        }
    } else if (commandLower === 'export log') {
        // exportLogFile uses browser APIs and is best handled client-side.
        // The main logic is in page.tsx, triggered by this command word.
        // This branch in the server action can just confirm the action is recognized.
         outputLines = [{ id: `log-export-info-${timestamp}`, text: 'Log export initiated client-side. Check your downloads.', type: 'info', category: 'internal' }];
        // The actual file generation/download happens in the handleCommandSubmit function in page.tsx
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

  // Important: Server Actions cannot directly modify client state like `setLogEntries`
  // The state update for `logEntries` needs to be handled on the client side after the Server Action completes.
  // The `addLogEntry` function call here relies on the client-side hook logic to eventually update state.

  return [commandOutput, ...outputLines];
};
