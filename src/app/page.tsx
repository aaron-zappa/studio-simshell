
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions'; // Import suggestion hook
import { executeCommand } from '@/lib/command-executor'; // Import command executor
import type { CommandMode } from '@/types/command-types'; // Import shared type
import { exportLogFile, type LogEntry } from '@/lib/logging'; // Import LogEntry type and exportLogFile

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [currentMode, setCurrentMode] = React.useState<CommandMode>('internal');
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]); // State for logging
  const { suggestions, addSuggestion, getCurrentSuggestions, initialSuggestions } = useSuggestions(); // Suggestions hook
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands(); // Custom commands hook

  const handleCommandSubmit = async (command: string) => { // Make async
    const commandLower = command.toLowerCase().trim();
    let output: OutputLine[] = []; // Initialize output array

    // Handle internal 'clear' command locally
    if (currentMode === 'internal' && commandLower === 'clear') {
      setHistory([]);
      return;
    }

     // Handle 'export log' client-side due to browser API usage
    if (currentMode === 'internal' && commandLower === 'export log') {
        const exportResult = exportLogFile(logEntries); // Call client-side export
        const commandOutput: OutputLine = {
           id: `cmd-${Date.now()}`, // Use timestamp for unique ID
           text: command,
           type: 'command',
           category: 'internal',
        };
        if (exportResult) {
            setHistory((prev) => [...prev, commandOutput, exportResult]);
        } else {
             // Handle case where exportLogFile returns null (e.g., no logs)
             const noLogOutput: OutputLine = {
                id: `log-export-empty-${Date.now()}`,
                text: 'No log entries to export.',
                type: 'info',
                category: 'internal'
            };
             setHistory((prev) => [...prev, commandOutput, noLogOutput]);
        }
        return; // Stop further processing for export log
    }


    // Handle internal 'mode' command locally to change state
    if (currentMode === 'internal' && commandLower.startsWith('mode ')) {
        const newMode = command.split(' ')[1]?.toLowerCase() as CommandMode | undefined;
         // Check against static list of modes
        if (newMode && Object.keys(initialSuggestions).includes(newMode)) {
             // Execute command returns the info/error message for mode change
             output = await executeCommand({ // Use await
                 command,
                 mode: currentMode,
                 addSuggestion,
                 addCustomCommand,
                 getCustomCommandAction,
                 logEntries,
                 setLogEntries, // Pass setter (potential issue noted in command-executor)
                 initialSuggestions
             });
             // Apply mode change *after* successful command execution confirmation
             setCurrentMode(newMode);
        } else {
            // Let executeCommand handle the error message
            output = await executeCommand({ // Use await
                command,
                mode: currentMode,
                addSuggestion,
                addCustomCommand,
                getCustomCommandAction,
                logEntries,
                setLogEntries, // Pass setter
                initialSuggestions
            });
            // Do not change mode if invalid
        }
    } else {
        // Execute other commands (including custom internal ones) via Server Action
         output = await executeCommand({ // Use await
            command,
            mode: currentMode,
            addSuggestion,
            addCustomCommand,
            getCustomCommandAction,
            logEntries,
            setLogEntries, // Pass setter
            initialSuggestions
         });
    }

    // Update history with the output from the command execution
    setHistory((prev) => [...prev, ...output]);

    // TODO: Add command analysis, validation, real execution logic here
    // TODO: Store command history in SQLite
    // TODO: Implement define/refine mechanisms
  };

  const handleModeChange = (value: string) => {
     const newMode = value as CommandMode;
      // Simulate typing 'mode [newMode]' in internal mode
      const previousMode = currentMode;
      setCurrentMode('internal'); // Temporarily switch to internal to process 'mode' command
      handleCommandSubmit(`mode ${newMode}`).then(() => { // handle async
        // Check if the mode actually changed (was valid) after the async operation
         if (!Object.keys(initialSuggestions).includes(newMode)) {
            // If the awaited call resulted in an error (output indicates failure),
            // or if the mode didn't actually change in the state (e.g., due to error), revert.
            // A more robust check might involve inspecting the output array for errors.
            // For simplicity, we revert if the selected value isn't a valid mode key.
            setCurrentMode(previousMode);
         }
      }).catch(error => {
          console.error("Failed to handle mode change:", error);
          setCurrentMode(previousMode); // Revert on error
      });
  }

   // Get combined suggestions for the current mode
   const currentSuggestions = getCurrentSuggestions(
        currentMode,
        customCommands // Pass customCommands directly
   );

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
                     {/* Use static list of modes for the dropdown */}
                    {(Object.keys(initialSuggestions) as CommandMode[]).map(mode => (
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
            suggestions={currentSuggestions} // Use combined suggestions
            currentMode={currentMode}
         />
      </footer>
    </div>
  );
}
