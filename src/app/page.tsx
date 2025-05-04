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
import { type LogEntry } from '@/types/log-types';
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils'; // Import cn
import { getDbStatusAction } from '@/lib/database'; // Import the status action

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast();

  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(['internal', 'python']); // Changed initial categories
  const { suggestions, addSuggestion, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();


  // --- Fetch and display DB status on initial load ---
  React.useEffect(() => {
    const fetchDbStatus = async () => {
        try {
            const status = await getDbStatusAction();
            const timestamp = new Date().toISOString();
            let statusType: OutputLine['type'] = 'info';
            let logType: LogEntry['type'] = 'I';

            // Check if the status message indicates failure ('nok')
            if (status.includes('nok')) {
                statusType = 'error';
                logType = 'E';
            }

            const statusLine: OutputLine = {
                id: `db-status-${timestamp}`,
                text: status,
                type: statusType, // Use determined type
                category: 'internal',
                timestamp: timestamp, // Add timestamp for log format
            };
            // Use functional update to ensure latest state
            setHistory(prev => [...prev, statusLine]);
            // Also add to log entries
            setLogEntries(prev => [...prev, { timestamp, type: logType, text: status }]); // Use determined type
        } catch (error) {
            console.error("Failed to fetch DB status:", error);
            const timestamp = new Date().toISOString();
             const errorLine: OutputLine = {
                id: `db-status-err-${timestamp}`,
                text: `Error fetching DB status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error',
                category: 'internal',
                timestamp: timestamp,
             };
             setHistory(prev => [...prev, errorLine]);
             setLogEntries(prev => [...prev, { timestamp, type: 'E', text: errorLine.text }]);
        }
    };
    // Run only once on component mount
    fetchDbStatus();
  }, []); // Empty dependency array ensures this runs once

  const handleCategoryChange = (category: CommandMode, checked: boolean | 'indeterminate') => {
    setSelectedCategories(prev =>
      checked
        ? [...prev, category]
        : prev.filter(c => c !== category)
    );
  };

  // --- Client-side clipboard access ---
  const readClipboard = async (): Promise<string> => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      throw new Error("Clipboard API not available or permission denied.");
    }
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      throw new Error("Failed to read clipboard. Check browser permissions.");
    }
  };
  // --- End client-side clipboard access ---


  const handleCommandSubmit = async (originalCommand: string) => {
    const commandTrimmed = originalCommand.trim();
    const commandLower = commandTrimmed.toLowerCase();
    const timestamp = new Date().toISOString();
    let commandLogOutput: OutputLine | null = null;
    setIsRunning(true);

    let finalCommand = commandTrimmed; // Use this variable for execution
    // Declare finalCommandLower outside the try block and initialize
    let finalCommandLower: string = '';
    let clipboardReadError: string | null = null;

    // --- Client-side Pre-processing for Clipboard ---
    const clipboardGetRegex = /^\s*clipboard\s*=\s*get\(\)\s*$/i;
    if (clipboardGetRegex.test(commandTrimmed)) {
       try {
         const clipboardContent = await readClipboard();
         // Replace the command with the actual assignment including the content
         // Escape quotes within the clipboard content before inserting into the string
         const escapedContent = clipboardContent.replace(/"/g, '\\"');
         finalCommand = `clipboard = "${escapedContent}"`;
         finalCommandLower = finalCommand.toLowerCase(); // Update finalCommandLower here
         console.log("Clipboard content read, command transformed:", finalCommand);
       } catch (error) {
         console.error("Clipboard read error:", error);
         clipboardReadError = error instanceof Error ? error.message : 'Unknown clipboard error';
         // Don't execute the command if clipboard read failed
         finalCommand = ''; // Prevent execution
         finalCommandLower = ''; // Update finalCommandLower here too
       }
    } else {
        // If it's not a clipboard command, initialize finalCommandLower
        finalCommandLower = finalCommand.toLowerCase();
    }
    // --- End Client-side Pre-processing ---


    let classificationResult: { category: CommandCategory; reasoning?: string | undefined } | null = null;
    let executionResult: { outputLines: OutputLine[]; newLogEntries?: LogEntry[] | undefined } | null = null;
    let errorOccurred = false;

    try {
      // Handle immediate clipboard read error
      if (clipboardReadError) {
        throw new Error(clipboardReadError); // Throw to enter the catch block
      }
      // If clipboard processing resulted in an empty command, skip execution
      if (!finalCommand) {
         // Log the original attempt but don't proceed
         commandLogOutput = {
             id: `cmd-clipboard-skip-${timestamp}`,
             text: originalCommand, // Log the original command
             type: 'command',
             category: 'python', // Assume python category for clipboard get
             timestamp: timestamp
         };
         setHistory((prev) => [...prev, commandLogOutput]);
         // Log entry handled in catch block
         throw new Error("Command execution skipped due to clipboard read failure.");
      }


      classificationResult = await classifyCommand({
          command: finalCommand, // Use the potentially modified command for classification
          activeCategories: selectedCategories
      });
      const category: CommandCategory = classificationResult.category;
      const classificationReasoning = classificationResult.reasoning;

      // Log the original command entered by the user, but use finalCommand for execution logic
      commandLogOutput = {
         id: `cmd-${timestamp}`,
         text: originalCommand, // Always log the original command
         type: 'command',
         // Classify the log based on the *execution* category
         category: (category === 'ambiguous' || category === 'unknown') ? 'internal' : category,
         timestamp: timestamp
      };

      if (category === 'ambiguous' || category === 'unknown') {
        const ambiguousOutput: OutputLine = {
          id: `class-err-${timestamp}`,
          text: category === 'ambiguous'
              ? `Command is ambiguous within active categories (${selectedCategories.join(', ')}). ${classificationReasoning || 'Please specify context or be more specific.'}`
              : `Command not recognized within active categories (${selectedCategories.join(', ')}). ${classificationReasoning || 'Please try again or type "help".'}`,
          type: 'error',
          category: 'internal',
          timestamp: timestamp,
        };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        const classificationLog: LogEntry = {
            timestamp,
            type: 'W',
            text: ambiguousOutput.text
        };
        setLogEntries(prev => [...prev, classificationLog]);
        setIsRunning(false);
        return;
      }

      let clientHandled = false;
      // Use finalCommandLower for internal checks (now declared outside try)
      if (category === 'internal') {
         if (finalCommandLower === 'clear') {
          setHistory([]);
          const clearLog: LogEntry = { timestamp, type: 'I', text: "History cleared." };
          setLogEntries(prev => [...prev, clearLog]);
          clientHandled = true;
         }
         else if (finalCommandLower === 'export log') {
          const exportResultLine = exportLogFile(logEntries);
          const logText = exportResultLine ? exportResultLine.text : "Attempted log export.";
          const logType = exportResultLine?.type === 'error' ? 'E' : 'I';
          const exportLog: LogEntry = { timestamp, type: logType, text: logText };
          setLogEntries(prev => [...prev, exportLog]);
          if(commandLogOutput && exportResultLine){
             if(exportResultLine.type === 'error' || exportResultLine.type === 'info'){
                 exportResultLine.timestamp = timestamp;
             }
             setHistory((prev) => [...prev, commandLogOutput, exportResultLine]);
          }
          clientHandled = true;
         }
         else if (finalCommandLower === 'pause') {
           const pauseOutput: OutputLine = {
             id: `pause-${timestamp}`,
             text: 'task stopped',
             type: 'info',
             category: 'internal',
             timestamp: timestamp,
           };
            if(commandLogOutput){
               setHistory((prev) => [...prev, commandLogOutput, pauseOutput]);
            }
            const pauseLog: LogEntry = { timestamp, type: 'I', text: "Task paused." };
            setLogEntries(prev => [...prev, pauseLog]);
           setIsRunning(false);
           clientHandled = true;
         }
         // Removed the specific 'echo "hello SimShell demo!"' handling
      }


      if (clientHandled) {
         // Use finalCommandLower for pause check
         if (finalCommandLower !== 'pause') setIsRunning(false);
         return;
      }

      executionResult = await executeCommand({
        command: finalCommand, // Pass the final command (potentially with clipboard content)
        mode: category as CommandMode,
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        currentLogEntries: logEntries,
        initialSuggestions
      });

      const outputToDisplay = executionResult.outputLines.filter(line => line.type !== 'command');
       if(commandLogOutput){
         setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
       }

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
        const errorOutput: OutputLine = {
            id: `error-${timestamp}`,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            category: 'internal',
            timestamp: timestamp,
        };
         const errorLog: LogEntry = { timestamp, type: 'E', text: errorMsg };
         if (executionResult?.newLogEntries) {
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         // Ensure commandLogOutput exists even if classification failed early due to clipboard error
         const cmdLog = commandLogOutput || { id: `cmd-err-${timestamp}`, text: originalCommand, type: 'command', category: 'internal', timestamp: timestamp };
         setHistory((prev) => [...prev, cmdLog, errorOutput]);


    } finally {
      // Use finalCommandLower for pause check (it's now accessible here)
      if (finalCommandLower !== 'pause' && !errorOccurred) {
          setIsRunning(false);
      } else if (errorOccurred) {
          setIsRunning(false);
      }
    }
  };

   const filteredSuggestionsForInput = React.useMemo(() => {
       const combinedSuggestions = new Set<string>();
        selectedCategories.forEach(cat => {
           (suggestions[cat] || []).forEach(sug => combinedSuggestions.add(sug));
           if (cat === 'internal') {
                Object.keys(customCommands).forEach(cmdName => combinedSuggestions.add(cmdName));
           }
            // Add clipboard suggestion if python is active
           if (cat === 'python') {
               combinedSuggestions.add('clipboard = get()');
           }
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-2 flex-wrap gap-4"> {/* Reduced bottom margin */}
        <h1 className="text-lg font-semibold">SimShell</h1> {/* Reduced text size */}
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

       <main className="flex-grow-[0.6] flex-shrink overflow-hidden mb-2"> {/* Adjusted flex-grow */}
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
