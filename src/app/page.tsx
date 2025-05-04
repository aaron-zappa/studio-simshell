// src/app/page.tsx
// src/app/page.tsx
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
import { useCustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions';
import { executeCommand } from '@/lib/command-executor';
import { CommandMode, ALL_COMMAND_MODES } from '@/types/command-types'; // Import CommandMode and ALL_COMMAND_MODES
import { exportLogFile, type LogEntry } from '@/lib/logging';
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow'; // Import classification flow
import { useToast } from "@/hooks/use-toast"; // Import toast

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  // Store log entries in state to pass to export function
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast(); // Toast hook for notifications

  // State for selected categories, default to all selected
  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(ALL_COMMAND_MODES);

  // Suggestions hook now returns categorized suggestions
  const { suggestions, addSuggestion, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();

  const handleCategoryChange = (category: CommandMode, checked: boolean | 'indeterminate') => {
    setSelectedCategories(prev =>
      checked
        ? [...prev, category]
        : prev.filter(c => c !== category)
    );
  };

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
             // exportLogFile handles the "no log" case internally now
            console.error("exportLogFile returned null unexpectedly when log should exist"); // Should not happen
             const errOut: OutputLine = { id: `log-export-err-${timestamp}`, text: 'Error during log export.', type: 'error', category: 'internal' };
            setHistory((prev) => [...prev, cmdOut, errOut]);
          }
          clientHandled = true;
        } else if (commandLower === 'pause') {
           const cmdOut: OutputLine = { ...commandOutputBase, id: `cmd-${timestamp}`, text: command, category: 'internal' };
           const pauseOutput: OutputLine = {
             id: `pause-${timestamp}`,
             text: 'task stopped', // Updated feedback message
             type: 'info',
             category: 'internal',
           };
           setHistory((prev) => [...prev, cmdOut, pauseOutput]);
           // Assume 'pause' stops things immediately client-side
           setIsRunning(false);
           clientHandled = true;
        }
      }

      if (clientHandled) {
         // No explicit state change needed if already set to false by pause logic
        return; // Stop further processing if handled client-side
      }

      // --- Server-Side Command Execution ---
      // If not handled client-side, execute via Server Action, passing the determined category
      // Critical Change: We now update logEntries state based on the result from executeCommand
      const { outputLines, newLogEntries } = await executeCommand({
        command,
        mode: category as CommandMode, // Pass the classified category as the mode
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        currentLogEntries: logEntries, // Pass current log entries
        initialSuggestions
      });

      // Update local logEntries state if the server action modified them
       if (newLogEntries) {
          setLogEntries(newLogEntries);
       }

       // Update history with just the command output
       setHistory((prev) => [...prev, ...outputLines]);


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

   // Calculate suggestions based on selected categories
   const filteredSuggestionsForInput = React.useMemo(() => {
       const combinedSuggestions = new Set<string>();
        selectedCategories.forEach(cat => {
           (suggestions[cat] || []).forEach(sug => combinedSuggestions.add(sug));
           // Add custom internal commands if 'internal' category is selected
           if (cat === 'internal') {
                Object.keys(customCommands).forEach(cmdName => combinedSuggestions.add(cmdName));
           }
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">SimuShell</h1>
          {/* Category Checkboxes */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm font-medium mr-2">Show Suggestions For:</span>
              {ALL_COMMAND_MODES.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                          id={`category-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={(checked) => handleCategoryChange(category, checked)}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm font-normal capitalize">
                          {category}
                      </Label>
                  </div>
              ))}
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
            suggestions={filteredSuggestionsForInput} // Provide filtered suggestions
            disabled={isRunning}
         />
      </footer>
    </div>
  );
}

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
function getFilename(): string {
    return 'page.tsx';
}
