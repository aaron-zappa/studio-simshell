"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Separator } from "@/components/ui/separator";
// Checkbox and Label are removed as mode selection is gone
// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
import { useCustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions';
import { executeCommand } from '@/lib/command-executor';
import type { CommandMode } from '@/types/command-types';
import { exportLogFile, type LogEntry } from '@/lib/logging';
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow'; // Import classification flow
import { useToast } from "@/hooks/use-toast"; // Import toast

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  // const [currentMode, setCurrentMode] = React.useState<CommandMode>('internal'); // Removed mode state
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast(); // Toast hook for notifications

  // Suggestions hook now returns all suggestions potentially
  const { suggestions, addSuggestion, getAllSuggestions, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();

  const handleCommandSubmit = async (command: string) => {
    const commandLower = command.toLowerCase().trim();
    const timestamp = Date.now();
    let output: OutputLine[] = [];
    setIsRunning(true); // Set running state

    try {
      // --- Classify Command (AI Call) ---
      const classificationResult = await classifyCommand({ command });
      const category: CommandCategory = classificationResult.category;
      const classificationReasoning = classificationResult.reasoning;

      const commandOutputBase: Omit<OutputLine, 'id' | 'text' | 'category'> = {
         type: 'command',
      };

      // Handle ambiguous or unknown commands
      if (category === 'ambiguous' || category === 'unknown') {
        const ambiguousOutput: OutputLine = {
          id: `class-err-${timestamp}`,
          text: category === 'ambiguous'
              ? `Command is ambiguous. ${classificationReasoning || 'Please specify context or be more specific.'}`
              : `Command not recognized. ${classificationReasoning || 'Please try again or type "help".'}`,
          type: 'error',
          category: 'internal', // Assign a default category for display
        };
         const commandLogOutput: OutputLine = {
            ...commandOutputBase,
            id: `cmd-${timestamp}`,
            text: command,
            category: 'internal', // Log ambiguous/unknown under internal for now
         };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        setIsRunning(false);
        return;
      }

      // --- Client-Side Internal Command Handling ---
      // Handle specific internal commands directly on the client if classified correctly
      let clientHandled = false;
      if (category === 'internal') {
        if (commandLower === 'clear') {
          setHistory([]);
          clientHandled = true;
        } else if (commandLower === 'export log') {
          const exportResult = exportLogFile(logEntries);
          const cmdOut: OutputLine = { ...commandOutputBase, id: `cmd-${timestamp}`, text: command, category: 'internal'};
          if (exportResult) {
            setHistory((prev) => [...prev, cmdOut, exportResult]);
          } else {
            const noLogOutput: OutputLine = {
              id: `log-export-empty-${timestamp}`,
              text: 'No log entries to export.',
              type: 'info',
              category: 'internal'
            };
            setHistory((prev) => [...prev, cmdOut, noLogOutput]);
          }
          clientHandled = true;
        } else if (commandLower === 'pause') {
           const cmdOut: OutputLine = { ...commandOutputBase, id: `cmd-${timestamp}`, text: command, category: 'internal' };
           let pauseOutput: OutputLine;
           // Check some *client-side* indicator if a task is conceptually running
           // For now, just acknowledge. Proper cancellation needs more state/logic.
           pauseOutput = {
             id: `pause-${timestamp}`,
             text: 'task stopped', // Changed feedback message
             type: 'info',
             category: 'internal',
           };
           setHistory((prev) => [...prev, cmdOut, pauseOutput]);
           // Consider if 'pause' should actually stop a server action in progress (needs AbortController etc.)
           clientHandled = true;
           setIsRunning(false); // Assuming pause stops things immediately
        }
      }

      if (clientHandled) {
        if (commandLower !== 'pause') setIsRunning(false); // Reset running state if handled unless it was pause
        return; // Stop further processing if handled client-side
      }

      // --- Server-Side Command Execution ---
      // If not handled client-side, execute via Server Action, passing the determined category
      output = await executeCommand({
        command,
        mode: category as CommandMode, // Pass the classified category as the mode
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        logEntries,
        setLogEntries, // Still passing, but aware of limitations
        initialSuggestions
      });

      // Add classification info to history (optional)
      // const classificationOutput: OutputLine = {
      //    id: `classify-${timestamp}`,
      //    text: `Classified as: ${category}${classificationReasoning ? ` (${classificationReasoning})` : ''}`,
      //    type: 'info',
      //    category: 'internal',
      // };
      // setHistory((prev) => [...prev, classificationOutput, ...output]);

       // Update history with just the command output
       setHistory((prev) => [...prev, ...output]);


    } catch (error) {
        console.error("Error during command handling:", error);
        toast({ // Use toast for user feedback on errors
           title: "Command Error",
           description: `Failed to process command: ${error instanceof Error ? error.message : 'Unknown error'}`,
           variant: "destructive",
        });
        // Add basic error line to history as well
        const errorOutput: OutputLine = {
            id: `error-${timestamp}`,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            category: 'internal', // Default category for general errors
        };
        setHistory((prev) => [...prev, errorOutput]);
    } finally {
      // Reset running state unless handled by 'pause' earlier
      if (commandLower !== 'pause') {
          setIsRunning(false);
      }
    }
  };

   // Get suggestions across all relevant modes
   const allCurrentSuggestions = getAllSuggestions(customCommands);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">SimuShell</h1>
         {/* Mode selection Checkboxes removed */}
         {/* <div className="flex items-center space-x-4"> ... </div> */}
      </header>

      <Separator className="mb-4" />

      <main className="flex-1 overflow-hidden mb-4">
        <OutputDisplay history={history} className="h-full" />
      </main>

      <Separator className="mb-4" />

      <footer className="shrink-0">
        <CommandInput
            onSubmit={handleCommandSubmit}
            suggestions={allCurrentSuggestions} // Provide all suggestions
            // currentMode is removed as prop
            disabled={isRunning}
         />
      </footer>
    </div>
  );
}