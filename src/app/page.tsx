
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
            text: 'Stop task requested. (Simulation)', // Feedback that the stop was attempted
            type: 'info',
            category: 'internal',
          };
          // Here you would signal the actual task cancellation if possible
          // For now, we just provide feedback and prevent further execution *of this command*
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
      setIsRunning(false); // Ensure running state is reset
    }

    // TODO: Store command history in SQLite
    // TODO: Implement define/refine mechanisms
  };

  const handleModeChange = (value: string) => {
     const newMode = value as CommandMode;
     const previousMode = currentMode;

     // Optimistically update UI for responsiveness, but rely on handleCommandSubmit for actual state change logic
     // setCurrentMode(newMode); // Temporarily removed optimistic update for stricter logic

     // Simulate typing 'mode [newMode]' in internal mode
     setCurrentMode('internal'); // Temporarily switch to internal to process 'mode' command via handleCommandSubmit
     handleCommandSubmit(`mode ${newMode}`).then(() => {
        // After the async operation, check if the mode *actually* changed.
        // This check is implicitly handled within handleCommandSubmit now.
        // If the mode change failed (due to invalid mode), setCurrentMode(newMode) wouldn't have been called inside handleCommandSubmit.
        // We need to ensure the dropdown reflects the *actual* state after the attempt.
        // If the newMode submitted was invalid, the state might still be 'internal' or revert.
        // A robust way is to check the `output` from handleCommandSubmit, but that's complex here.
        // Let's read the state *after* the await. If it didn't become `newMode`, revert dropdown.
        // Note: This still has potential race conditions if multiple changes happen quickly.
        // Reading the state right after the async call might not be reliable.
        // A safer approach might involve getting the final state from `handleCommandSubmit`.
        // For now, we revert if the submitted mode was invalid.
        if (!Object.keys(initialSuggestions).includes(newMode)) {
            setCurrentMode(previousMode); // Revert dropdown/state if mode was invalid
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
            disabled={isRunning} // Disable input while a command is running
         />
      </footer>
    </div>
  );
}
