
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
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
  const [isRunning, setIsRunning] = React.useState<boolean>(false); // Track if a command is running
  const { suggestions, addSuggestion, getCurrentSuggestions, initialSuggestions } = useSuggestions(); // Suggestions hook
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands(); // Custom commands hook

  const handleCommandSubmit = async (command: string) => {
    const commandLower = command.toLowerCase().trim();
    let output: OutputLine[] = []; // Initialize output array
    const timestamp = Date.now(); // Timestamp for unique IDs

    // --- Client-Side Command Handling (before calling Server Action) ---

    // Handle internal 'clear' command locally
    if (currentMode === 'internal' && commandLower === 'clear') {
      setHistory([]);
      return;
    }

    // Handle 'export log' client-side due to browser API usage
    if (currentMode === 'internal' && commandLower === 'export log') {
      const exportResult = exportLogFile(logEntries); // Call client-side export
      const commandOutput: OutputLine = {
        id: `cmd-${timestamp}`,
        text: command,
        type: 'command',
        category: 'internal',
      };
      if (exportResult) {
        setHistory((prev) => [...prev, commandOutput, exportResult]);
      } else {
        const noLogOutput: OutputLine = {
          id: `log-export-empty-${timestamp}`,
          text: 'No log entries to export.',
          type: 'info',
          category: 'internal'
        };
        setHistory((prev) => [...prev, commandOutput, noLogOutput]);
      }
      return; // Stop further processing
    }

    // Handle 'pause' command client-side (simulation)
    if (currentMode === 'internal' && commandLower === 'pause') {
       const commandOutput: OutputLine = {
         id: `cmd-${timestamp}`,
         text: command,
         type: 'command',
         category: 'internal',
       };
       let pauseOutput: OutputLine;
       if (isRunning) {
          // Simulate stopping the task. In a real scenario, you'd use AbortController or similar.
          pauseOutput = {
            id: `pause-${timestamp}`,
            text: 'task stopped', // Changed feedback message
            type: 'info',
            category: 'internal',
          };
          // Here you would signal the actual task cancellation if possible
          // For now, we just provide feedback and prevent further execution *of this command*
          setIsRunning(false); // Immediately set isRunning to false to reflect the stop
       } else {
          pauseOutput = {
            id: `pause-${timestamp}`,
            text: 'No task currently running to stop.',
            type: 'info',
            category: 'internal',
          };
       }
       setHistory((prev) => [...prev, commandOutput, pauseOutput]);
       return; // Stop processing, don't call executeCommand for 'pause'
    }

    // --- Server-Side Command Execution ---
    setIsRunning(true); // Set running state before calling the potentially long action
    try {
      // Handle internal 'mode' command locally to change state *after* confirmation
      if (currentMode === 'internal' && commandLower.startsWith('mode ')) {
        const newMode = command.split(' ')[1]?.toLowerCase() as CommandMode | undefined;
        // Let executeCommand validate the mode and return feedback
        output = await executeCommand({
          command,
          mode: currentMode,
          addSuggestion,
          addCustomCommand,
          getCustomCommandAction,
          logEntries,
          setLogEntries,
          initialSuggestions
        });

        // Check if the output indicates success (absence of 'Error:' might be a simple check)
        const modeChangeSuccessful = !output.some(line => line.type === 'error' && line.text.includes('Invalid mode'));

        if (newMode && modeChangeSuccessful && Object.keys(initialSuggestions).includes(newMode)) {
            setCurrentMode(newMode); // Apply mode change only on success
        }
        // No need for an else block, the error message is already in 'output'
      } else {
        // Execute other commands (including custom internal ones) via Server Action
        output = await executeCommand({
          command,
          mode: currentMode,
          addSuggestion,
          addCustomCommand,
          getCustomCommandAction,
          logEntries,
          setLogEntries,
          initialSuggestions
        });
      }

      // Update history with the output from the command execution
      setHistory((prev) => [...prev, ...output]);

    } catch (error) {
        console.error("Error executing command:", error);
        const errorOutput: OutputLine = {
            id: `error-${timestamp}`,
            text: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            category: currentMode,
        };
        setHistory((prev) => [...prev, errorOutput]);
    } finally {
      // Only set isRunning false here if it wasn't already set by 'pause'
      if (commandLower !== 'pause') {
          setIsRunning(false);
      }
    }

    // TODO: Store command history in SQLite
    // TODO: Implement define/refine mechanisms
  };

  // Handler for Checkbox mode changes
  const handleModeChange = (newMode: CommandMode) => {
     const previousMode = currentMode;
     if (newMode === previousMode) return; // No change if clicking the already active mode

     // Simulate typing 'mode [newMode]' in internal mode
     const tempOriginalMode = currentMode; // Store original mode before temporarily switching
     setCurrentMode('internal'); // Temporarily switch to internal to process 'mode' command via handleCommandSubmit

     handleCommandSubmit(`mode ${newMode}`).then(() => {
         // Check if the state actually updated to newMode after the async call
         // Since setCurrentMode is called *inside* handleCommandSubmit on success,
         // we don't need to explicitly check output here. The state should reflect the result.
         // If it failed, the state should remain 'internal' or revert based on previous logic.
         // Read the state *after* the await. If it didn't become `newMode`, revert.
         // Note: Needs React.startTransition or similar for optimal UX in concurrent mode
         if (!Object.keys(initialSuggestions).includes(newMode)) {
            // If the mode submitted was invalid, revert the internal state change
            setCurrentMode(tempOriginalMode);
         }
         // If successful, currentMode would have been set to newMode inside handleCommandSubmit
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

   const allModes = Object.keys(initialSuggestions) as CommandMode[];

  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">SimuShell</h1>
         <div className="flex items-center space-x-4">
           <Label className="text-sm font-medium shrink-0">Mode:</Label>
           <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
             {allModes.map(mode => (
               <div key={mode} className="flex items-center space-x-2">
                 <Checkbox
                   id={`mode-${mode}`}
                   checked={currentMode === mode}
                   onCheckedChange={(checked) => {
                     // Only trigger change if checking the box
                     if (checked) {
                       handleModeChange(mode);
                     }
                     // Don't allow unchecking the active box directly, must select another
                   }}
                 />
                 <Label
                   htmlFor={`mode-${mode}`}
                   className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                 >
                   {mode.charAt(0).toUpperCase() + mode.slice(1)}
                 </Label>
               </div>
             ))}
           </div>
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
            disabled={isRunning} // Disable input while a command is running
         />
      </footer>
    </div>
  );
}

