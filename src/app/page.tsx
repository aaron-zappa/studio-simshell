// src/app/page.tsx
// src/app/page.tsx
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions';
import { executeCommand } from '@/lib/command-executor';
import { CommandMode, ALL_COMMAND_MODES } from '@/types/command-types';
import { exportLogFile } from '@/lib/logging';
import { type LogEntry } from '@/types/log-types'; // Import the new LogEntry type
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow';
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]); // Uses new LogEntry type
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast();

  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(['sql']);
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
    const timestamp = new Date().toISOString(); // Use ISO string for consistency
    let commandLogOutput: OutputLine | null = null; // For logging the command itself
    setIsRunning(true);

    let classificationResult: { category: CommandCategory; reasoning?: string | undefined } | null = null;
    let executionResult: { outputLines: OutputLine[]; newLogEntries?: LogEntry[] | undefined } | null = null;
    let errorOccurred = false;

    try {
      // --- Classify Command (AI Call) ---
      classificationResult = await classifyCommand({
          command,
          activeCategories: selectedCategories
      });
      const category: CommandCategory = classificationResult.category;
      const classificationReasoning = classificationResult.reasoning;

      commandLogOutput = {
         id: `cmd-${timestamp}`,
         text: command,
         type: 'command',
         // Assign category based on classification, default to 'internal' if ambiguous/unknown
         category: (category === 'ambiguous' || category === 'unknown') ? 'internal' : category,
      };

      // Handle ambiguous or unknown commands based on active categories
      if (category === 'ambiguous' || category === 'unknown') {
        const ambiguousOutput: OutputLine = {
          id: `class-err-${timestamp}`,
          text: category === 'ambiguous'
              ? `Command is ambiguous within active categories (${selectedCategories.join(', ')}). ${classificationReasoning || 'Please specify context or be more specific.'}`
              : `Command not recognized within active categories (${selectedCategories.join(', ')}). ${classificationReasoning || 'Please try again or type "help".'}`,
          type: 'error',
          category: 'internal',
        };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        // Log the classification error itself
        const classificationLog: LogEntry = {
            timestamp,
            type: 'W', // Warning for ambiguous/unknown
            text: ambiguousOutput.text
        };
        setLogEntries(prev => [...prev, classificationLog]);
        setIsRunning(false);
        return;
      }

      // --- Client-Side Internal Command Handling (Limited) ---
      let clientHandled = false;
      if (category === 'internal') {
         // 'clear' is handled purely client-side
         if (commandLower === 'clear') {
          setHistory([]);
          // Log clear event
          const clearLog: LogEntry = { timestamp, type: 'I', text: "History cleared." };
          setLogEntries(prev => [...prev, clearLog]);
          clientHandled = true;
         }
         // 'export log' triggers client-side download
         else if (commandLower === 'export log') {
          const exportResultLine = exportLogFile(logEntries); // exportLogFile now returns OutputLine or null
          const logText = exportResultLine ? exportResultLine.text : "Attempted log export.";
          const logType = exportResultLine?.type === 'error' ? 'E' : 'I';
          const exportLog: LogEntry = { timestamp, type: logType, text: logText };
          setLogEntries(prev => [...prev, exportLog]);
          if(commandLogOutput && exportResultLine){
             setHistory((prev) => [...prev, commandLogOutput, exportResultLine]);
          }
          clientHandled = true;
         }
         // 'pause' is handled client-side for UI state
         else if (commandLower === 'pause') {
           const pauseOutput: OutputLine = {
             id: `pause-${timestamp}`,
             text: 'task stopped',
             type: 'info',
             category: 'internal',
           };
            if(commandLogOutput){
               setHistory((prev) => [...prev, commandLogOutput, pauseOutput]);
            }
            const pauseLog: LogEntry = { timestamp, type: 'I', text: "Task paused." };
            setLogEntries(prev => [...prev, pauseLog]);
           setIsRunning(false); // Stop execution indicator
           clientHandled = true;
         }
      }


      if (clientHandled) {
         // For pause, isRunning is already false. For others, reset it.
         if (commandLower !== 'pause') setIsRunning(false);
         return; // Stop further processing
      }

      // --- Server-Side Command Execution ---
      // Pass classified category, log state, and state modification functions (with caveats)
      executionResult = await executeCommand({
        command,
        mode: category as CommandMode,
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        currentLogEntries: logEntries, // Pass current log state
        initialSuggestions
      });

      // Update history with command output lines *excluding* the command itself
      // The command was logged above or by client handlers
      const outputToDisplay = executionResult.outputLines.filter(line => line.type !== 'command');
       if(commandLogOutput){
         setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
       }


      // Update local logEntries state if the server action returned new ones
       if (executionResult.newLogEntries) {
          setLogEntries(executionResult.newLogEntries);
       }


    } catch (error) {
        errorOccurred = true;
        console.error("Error during command handling:", error);
        const errorMsg = `Failed to process command: ${error instanceof Error ? error.message : 'Unknown error'}`;
        toast({
           title: "Command Error",
           description: errorMsg,
           variant: "destructive",
        });
        // Add basic error line to history
        const errorOutput: OutputLine = {
            id: `error-${timestamp}`,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            category: 'internal',
        };
         // Log the error
         const errorLog: LogEntry = { timestamp, type: 'E', text: errorMsg };
         // Ensure log state is updated even on error
         if (executionResult?.newLogEntries) {
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         // Show command and error in history
         if(commandLogOutput){
             setHistory((prev) => [...prev, commandLogOutput, errorOutput]);
         } else {
             // If classification failed before commandLogOutput was set
             const genericCommandLog: OutputLine = { id: `cmd-err-${timestamp}`, text: command, type: 'command', category: 'internal' };
             setHistory((prev) => [...prev, genericCommandLog, errorOutput]);
         }

    } finally {
      // Reset running state unless handled by 'pause' or an error occurred
      if (commandLower !== 'pause' && !errorOccurred) {
          setIsRunning(false);
      } else if (errorOccurred) {
          // Ensure isRunning is false after an error too
          setIsRunning(false);
      }
    }
  };

   // Calculate suggestions based on selected categories
   const filteredSuggestionsForInput = React.useMemo(() => {
       const combinedSuggestions = new Set<string>();
        selectedCategories.forEach(cat => {
           (suggestions[cat] || []).forEach(sug => combinedSuggestions.add(sug));
           if (cat === 'internal') {
                Object.keys(customCommands).forEach(cmdName => combinedSuggestions.add(cmdName));
           }
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h1 className="text-xl font-semibold">SimuShell</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm font-medium mr-2">Active Categories:</span>
              {ALL_COMMAND_MODES.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                          id={`category-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={(checked) => handleCategoryChange(category, checked)}
                          aria-label={`Toggle category ${category}`}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm font-normal capitalize">
                          {category}
                      </Label>
                  </div>
              ))}
          </div>
      </header>

       <main className="flex-grow-[0.8] flex-shrink overflow-hidden mb-4">
        <OutputDisplay history={history} className="h-full" />
      </main>

       <footer className="shrink-0">
        <CommandInput
            onSubmit={handleCommandSubmit}
            suggestions={filteredSuggestionsForInput}
            disabled={isRunning}
         />
      </footer>
    </div>
  );
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'page.tsx';
}
