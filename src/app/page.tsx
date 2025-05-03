"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// --- Mock Data & Logic (Replace with actual logic later) ---

// Initial suggestions, will be mutable
const initialSuggestions: Record<string, string[]> = {
  internal: ['help', 'clear', 'mode', 'history', 'define', 'refine', 'add internal command'],
  python: ['print(', 'def ', 'import ', 'class ', 'if ', 'else:', 'elif ', 'for ', 'while ', 'try:', 'except:', 'return ', 'yield '],
  unix: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'echo', 'man', 'sudo'],
  windows: ['dir', 'cd', 'cls', 'mkdir', 'rmdir', 'copy', 'move', 'type', 'findstr', 'echo', 'help'],
  sql: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY'],
};

// Use state for suggestions to allow dynamic updates
const useSuggestions = () => {
    const [suggestions, setSuggestions] = React.useState(initialSuggestions);

    const addSuggestion = (mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            if (!modeSuggestions.includes(command)) {
                return {
                    ...prev,
                    [mode]: [...modeSuggestions, command].sort(), // Add and sort
                };
            }
            return prev;
        });
    };

    return { suggestions, addSuggestion };
};


// Mock command execution (replace with actual simulation engine)
const executeCommand = (
    command: string,
    mode: CommandMode,
    addSuggestion: (mode: CommandMode, command: string) => void
): OutputLine[] => {
  const timestamp = new Date().toISOString(); // Simple unique ID
  const commandLower = command.toLowerCase().trim();
  const args = command.split(' ').slice(1);

  const commandOutput: OutputLine = {
    id: `cmd-${timestamp}`,
    text: command,
    type: 'command',
    category: mode,
  };

  let outputLines: OutputLine[] = [];

  // Internal commands
  if (mode === 'internal') {
    if (commandLower.startsWith('help')) {
      outputLines = [{ id: `out-${timestamp}`, text: `Available modes: internal, python, unix, windows, sql.\nUse 'mode [mode_name]' to switch.\nAvailable internal commands: help, clear, mode, history, define, refine, add internal command "<name>" <action>`, type: 'output', category: 'internal' }];
    } else if (commandLower === 'clear') {
      // Special case handled in handleCommandSubmit
      outputLines = [];
    } else if (commandLower.startsWith('mode ')) {
       const newMode = args[0] as CommandMode;
       if (Object.keys(initialSuggestions).includes(newMode)) { // Check against initial static modes
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
    } else if (commandLower.startsWith('add internal command ')) {
        // Regex to capture command name in quotes and the rest as action
        const addCmdRegex = /^add internal command "([^"]+)"\s+(.+)$/i;
        const match = command.match(addCmdRegex);

        if (match && match[1] && match[2]) {
            const newCommandName = match[1];
            const newCommandAction = match[2]; // Placeholder for action definition
            // Add to suggestions (in-memory for now)
            addSuggestion('internal', newCommandName);
            outputLines = [{ id: `out-${timestamp}`, text: `Added internal command: "${newCommandName}" (action: ${newCommandAction})`, type: 'info', category: 'internal' }];
            // TODO: Store command definition persistently (e.g., SQLite)
        } else {
            outputLines = [{ id: `out-${timestamp}`, text: `Error: Invalid syntax. Use: add internal command "<command_name>" <command_action>`, type: 'error', category: 'internal' }];
        }
    }
     else {
      // Check if it's a dynamically added command before showing error
      // This part needs refinement once dynamic command execution is implemented
      if (initialSuggestions.internal.includes(commandLower) || commandLower.split(' ')[0] in initialSuggestions.internal) {
           outputLines = [{ id: `out-${timestamp}`, text: `Internal command not found or invalid arguments: ${command}`, type: 'error', category: 'internal' }];
      } else {
          // Assume it might be a custom added command - placeholder execution
           outputLines = [{ id: `out-${timestamp}`, text: `Executing custom internal command: ${command} (placeholder)`, type: 'output', category: 'internal' }];
           // TODO: Implement execution logic for dynamically added commands
      }
    }
  }
  // Python simulation
  else if (mode === 'python') {
     if (commandLower.startsWith('print(')) {
        const match = command.match(/print\((['"])(.*?)\1\)/);
        outputLines = [{ id: `out-${timestamp}`, text: match ? match[2] : 'Syntax Error in print', type: match ? 'output' : 'error', category: 'python' }];
     } else {
        outputLines = [{ id: `out-${timestamp}`, text: `Simulating Python: ${command} (output placeholder)`, type: 'output', category: 'python' }];
     }
  }
   // Unix simulation
  else if (mode === 'unix') {
     if (commandLower === 'ls') {
         outputLines = [{ id: `out-${timestamp}`, text: 'file1.txt  directoryA  script.sh', type: 'output', category: 'unix' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'unix' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Unix: ${command} (output placeholder)`, type: 'output', category: 'unix' }];
     }
  }
    // Windows simulation
  else if (mode === 'windows') {
     if (commandLower === 'dir') {
         outputLines = [{ id: `out-${timestamp}`, text: ' Volume in drive C has no label.\n Volume Serial Number is XXXX-YYYY\n\n Directory of C:\\Users\\User\n\nfile1.txt\n<DIR>          directoryA\nscript.bat\n               3 File(s) ... bytes\n               1 Dir(s)  ... bytes free', type: 'output', category: 'windows' }];
     } else if (commandLower.startsWith('echo ')) {
         outputLines = [{ id: `out-${timestamp}`, text: command.substring(5), type: 'output', category: 'windows' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating Windows: ${command} (output placeholder)`, type: 'output', category: 'windows' }];
     }
  }
    // SQL simulation
  else if (mode === 'sql') {
     if (commandLower.startsWith('select')) {
         outputLines = [{ id: `out-${timestamp}`, text: `id | name\n---|-----\n1  | Alice\n2  | Bob\n(2 rows)`, type: 'output', category: 'sql' }];
     } else {
         outputLines = [{ id: `out-${timestamp}`, text: `Simulating SQL: ${command} (output placeholder)`, type: 'output', category: 'sql' }];
     }
  }

  return [commandOutput, ...outputLines];
};

// --- Component ---

type CommandMode = 'internal' | 'python' | 'unix' | 'windows' | 'sql';

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [currentMode, setCurrentMode] = React.useState<CommandMode>('internal');
  const { suggestions, addSuggestion } = useSuggestions(); // Use the hook

  const handleCommandSubmit = (command: string) => {
    const commandLower = command.toLowerCase().trim();

    // Handle internal 'clear' command locally
    if (currentMode === 'internal' && commandLower === 'clear') {
      setHistory([]);
      return;
    }

    // Handle internal 'mode' command locally to change state
    if (currentMode === 'internal' && commandLower.startsWith('mode ')) {
        const newMode = command.split(' ')[1] as CommandMode;
        if (Object.keys(suggestions).includes(newMode)) { // Check against current suggestions keys
             setCurrentMode(newMode);
             // Add confirmation to history *after* processing other output
             const output = executeCommand(command, currentMode, addSuggestion); // Get potential error message
             setHistory((prev) => [...prev, ...output]);
        } else {
            // Let executeCommand handle the error message
            const output = executeCommand(command, currentMode, addSuggestion);
            setHistory((prev) => [...prev, ...output]);
        }
        return;
    }


    // Execute other commands
    const output = executeCommand(command, currentMode, addSuggestion);
    setHistory((prev) => [...prev, ...output]);

    // TODO: Add command analysis, validation, real execution logic here
    // TODO: Store command history in SQLite
    // TODO: Implement define/refine mechanisms
    // TODO: Implement execution for dynamically added commands
  };

  const handleModeChange = (value: string) => {
     const newMode = value as CommandMode;
      // Simulate typing 'mode [newMode]' in internal mode
      const previousMode = currentMode;
      setCurrentMode('internal'); // Temporarily switch to internal to process 'mode' command
      handleCommandSubmit(`mode ${newMode}`);
      // Note: handleCommandSubmit will set the mode back if successful
      if (!Object.keys(suggestions).includes(newMode)) {
          setCurrentMode(previousMode); // Revert if mode change failed
      }
  }

  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">SimuShell</h1>
         <div className="flex items-center space-x-2">
           <Label htmlFor="mode-select" className="text-sm font-medium">Mode:</Label>
            <Select value={currentMode} onValueChange={handleModeChange}>
                <SelectTrigger id="mode-select" className="w-[120px]">
                    <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                    {(Object.keys(suggestions) as CommandMode[]).map(mode => (
                         <SelectItem key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
         </div>
      </header>

      <Separator className="mb-4" />

      <main className="flex-1 overflow-hidden mb-4">
        <OutputDisplay history={history} className="h-full" />
      </main>

      <Separator className="mb-4" />

      <footer className="shrink-0">
        <CommandInput
            onSubmit={handleCommandSubmit}
            suggestions={suggestions[currentMode] || []} // Use stateful suggestions
            currentMode={currentMode}
         />
      </footer>
    </div>
  );
}

    