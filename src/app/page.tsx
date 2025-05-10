// src/app/page.tsx
// src/app/page.tsx
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { SqlInputPanel } from '@/components/sql-input-panel'; // Import the new SQL input panel
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Import Accordion components
import { useCustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions';
import { executeCommand } from '@/lib/command-executor';
import { CommandMode, ALL_COMMAND_MODES } from '@/types/command-types';
import { exportLogFile } from '@/lib/logging';
import { type LogEntry } from '@/types/log-types';
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getDbStatusAction } from '@/lib/database';
import { executeSqlScript } from '@/lib/sql-script-runner'; // Import the SQL script runner

const SIMULATED_USER_ID = 1; // Assuming admin for now

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast();

  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(['internal', 'python']);
  const { suggestions, addSuggestion, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();

  React.useEffect(() => {
    const fetchDbStatus = async () => {
        try {
            const status = await getDbStatusAction();
            const timestamp = new Date().toISOString();
            let statusType: OutputLine['type'] = 'info';
            let logType: LogEntry['type'] = 'I';
            let logFlag: 0 | 1 = 0;

            if (status.includes('nok')) {
                statusType = 'error';
                logType = 'E';
            } else {
                logFlag = 0; // Ensure flag is 0 for success
            }


            const statusLine: OutputLine = {
                id: `db-status-${timestamp}`,
                text: status,
                type: statusType,
                category: 'internal',
                timestamp: timestamp,
                flag: logFlag,
            };
            setHistory(prev => [...prev, statusLine]);
            setLogEntries(prev => [...prev, { timestamp, type: logType, flag: logFlag, text: status }]);
        } catch (error) {
            console.error("Failed to fetch DB status:", error);
            const timestamp = new Date().toISOString();
             const errorLine: OutputLine = {
                id: `db-status-err-${timestamp}`,
                text: `Error fetching DB status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error',
                category: 'internal',
                timestamp: timestamp,
                flag: 0,
             };
             setHistory(prev => [...prev, errorLine]);
             setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 0, text: errorLine.text }]);
        }
    };
    fetchDbStatus();
  }, []);

  const handleCategoryChange = (category: CommandMode, checked: boolean | 'indeterminate') => {
    setSelectedCategories(prev =>
      checked
        ? [...prev, category]
        : prev.filter(c => c !== category)
    );
  };

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

  const handleDirectSqlSubmit = async (sqlInput: string) => {
    const commandTrimmed = sqlInput.trim();
    if (!commandTrimmed) return;

    setIsRunning(true);
    const timestamp = new Date().toISOString();
    const sqlScriptRegex = /^@sql:([a-zA-Z0-9_.-]+\.sql)$/i;
    const scriptMatch = commandTrimmed.match(sqlScriptRegex);

    if (scriptMatch && scriptMatch[1]) {
        const scriptFilename = scriptMatch[1];
        const commandLogOutput: OutputLine = {
            id: `cmd-sql-script-${timestamp}`,
            text: commandTrimmed, // Log the @sql: command itself
            type: 'command',
            category: 'sql',
            timestamp: timestamp,
        };
        setHistory(prev => [...prev, commandLogOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'I', flag: 0, text: `Executing SQL script file: ${scriptFilename}` }]);

        try {
            const scriptResult = await executeSqlScript(scriptFilename);
            
            if (scriptResult.outputLines) {
                const outputToDisplay = scriptResult.outputLines.map(line => ({
                    ...line,
                    flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 0 : 0) : undefined)
                }));
                 setHistory((prev) => [...prev, ...outputToDisplay]);
            }

            if (scriptResult.newLogEntries) {
                setLogEntries(prev => [...prev, ...scriptResult.newLogEntries]);
            }
             if (scriptResult.error) {
                 toast({
                    title: "SQL Script Error",
                    description: scriptResult.error,
                    variant: "destructive",
                 });
             } else {
                  toast({
                    title: "SQL Script",
                    description: `Script '${scriptFilename}' execution finished.`,
                    variant: "default",
                 });
             }

        } catch (error) {
            console.error("Error during SQL script execution:", error);
            const errorMsg = `Failed to execute SQL script '${scriptFilename}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            toast({
               title: "SQL Script Execution Error",
               description: errorMsg,
               variant: "destructive",
            });
            const errorOutput: OutputLine = {
                id: `sql-script-error-${timestamp}`,
                text: errorMsg,
                type: 'error',
                category: 'sql',
                timestamp: timestamp,
                flag: 0,
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 0, text: errorMsg }]);
        }
    } else {
        // Regular SQL command execution
        const commandLogOutput: OutputLine = {
            id: `cmd-sql-${timestamp}`,
            text: commandTrimmed,
            type: 'command',
            category: 'sql',
            timestamp: timestamp,
        };

        setHistory(prev => [...prev, commandLogOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'I', flag: 0, text: `Direct SQL command executed: ${commandTrimmed}` }]);

        try {
            const executionResult = await executeCommand({
                userId: SIMULATED_USER_ID,
                command: commandTrimmed,
                mode: 'sql',
                addSuggestion,
                addCustomCommand,
                getCustomCommandAction,
                currentLogEntries: logEntries,
                initialSuggestions,
                overridePermissionChecks: true, // Assuming override for direct SQL panel for now
            });

            const outputToDisplay = executionResult.outputLines
                .filter(line => line.id !== commandLogOutput?.id)
                .map(line => ({
                    ...line,
                    flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 0 : 0) : undefined)
                }));
            
            setHistory((prev) => [...prev, ...outputToDisplay]);

            if (executionResult.newLogEntries) {
                setLogEntries(prev => [...prev, ...executionResult.newLogEntries.filter(log => !logEntries.some(existing => existing.timestamp === log.timestamp && existing.text === log.text))]);
            }
            if (executionResult.toastInfo) {
                toast({
                    title: "AI Notification",
                    description: executionResult.toastInfo.message,
                    variant: executionResult.toastInfo.variant || 'default',
                });
            }

        } catch (error) {
            console.error("Error during direct SQL execution:", error);
            const errorMsg = `Failed to execute SQL: ${error instanceof Error ? error.message : 'Unknown error'}`;
            toast({
               title: "SQL Execution Error",
               description: errorMsg,
               variant: "destructive",
            });
            const errorOutput: OutputLine = {
                id: `sql-error-${timestamp}`,
                text: errorMsg,
                type: 'error',
                category: 'sql',
                timestamp: timestamp,
                flag: 0,
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 0, text: errorMsg }]);
        }
    }
    setIsRunning(false);
  };


  const handleCommandSubmit = async (originalCommand: string) => {
    const commandTrimmed = originalCommand.trim();
    const timestamp = new Date().toISOString();
    let commandLogOutput: OutputLine | null = null;
    let finalCommandLower = ''; // Initialize here
    setIsRunning(true);

    let finalCommand = commandTrimmed;
    let clipboardReadError: string | null = null;

    const clipboardGetRegex = /^\s*clipboard\s*=\s*get\(\)\s*$/i;
    if (clipboardGetRegex.test(commandTrimmed)) {
       try {
         const clipboardContent = await readClipboard();
         const escapedContent = clipboardContent.replace(/"/g, '\\"'); // Basic escaping for quotes
         finalCommand = `clipboard = "${escapedContent}"`;
       } catch (error) {
         console.error("Clipboard read error:", error);
         clipboardReadError = error instanceof Error ? error.message : 'Unknown clipboard error';
         finalCommand = ''; // Prevent execution if clipboard fails
       }
    }
    
    finalCommandLower = finalCommand.toLowerCase(); // Set finalCommandLower after potential modification


    let classificationResult: { category: CommandCategory; reasoning?: string | undefined } | null = null;
    let executionResult: {
        outputLines: OutputLine[];
        newLogEntries?: LogEntry[] | undefined;
        toastInfo?: { message: string; variant?: 'default' | 'destructive' } | undefined;
    } | null = null;
    let errorOccurred = false;

    try {
      if (clipboardReadError) {
        throw new Error(clipboardReadError);
      }
      if (!finalCommand && clipboardGetRegex.test(commandTrimmed)) { // Only throw if it was a clipboard command that failed
         commandLogOutput = {
             id: `cmd-clipboard-skip-${timestamp}`,
             text: originalCommand, // Log the original command
             type: 'command',
             category: 'python', // Assume python for clipboard = get()
             timestamp: timestamp
         };
         setHistory((prev) => [...prev, commandLogOutput]);
         throw new Error("Command execution skipped: Clipboard operation failed.");
      }
       if (!finalCommand && !clipboardGetRegex.test(commandTrimmed) && commandTrimmed.length > 0) {
          // This case should ideally not be reached if finalCommand is only empty due to clipboard error
          // but as a fallback for any other way finalCommand might be empty with an original command.
           commandLogOutput = {
             id: `cmd-empty-final-${timestamp}`,
             text: originalCommand,
             type: 'command',
             category: 'internal', // Default to internal if category unknown
             timestamp: timestamp
           };
           setHistory((prev) => [...prev, commandLogOutput]);
           throw new Error("Command execution skipped: Processed command is empty.");
       }
       if (!finalCommand && commandTrimmed.length === 0) { // No command was entered
            setIsRunning(false);
            return;
       }


      classificationResult = await classifyCommand({
          command: finalCommand, // Use the potentially modified command for classification
          activeCategories: selectedCategories
      });
      const category: CommandCategory = classificationResult.category;
      const classificationReasoning = classificationResult.reasoning;

      commandLogOutput = {
         id: `cmd-${timestamp}`,
         text: originalCommand, // Log the original command here
         type: 'command',
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
          flag: 0,
        };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        const classificationLog: LogEntry = {
            timestamp,
            type: 'W', // Warning for ambiguous/unknown
            flag: 1,   // Flag 1 for this type of warning
            text: `Command classification: ${category}. Reasoning: ${classificationReasoning || 'N/A'}. Original: '${originalCommand}', Processed: '${finalCommand}', Active: ${selectedCategories.join(', ')}`
        };
        setLogEntries(prev => [...prev, classificationLog]);
        setIsRunning(false);
        return;
      }

      let clientHandled = false;
      if (category === 'internal') {
         if (finalCommandLower === 'clear') {
          setHistory([]);
          const clearLog: LogEntry = { timestamp, type: 'I', flag: 0, text: "History cleared." };
          setLogEntries(prev => [...prev, clearLog]);
          clientHandled = true;
         }
         else if (finalCommandLower === 'export log') {
          const exportResultLine = exportLogFile(logEntries); // exportLogFile now returns OutputLine or null
           const logText = exportResultLine ? exportResultLine.text : "Log export action attempted.";
           const logType: LogEntry['type'] = exportResultLine?.type === 'error' ? 'E' : 'I';
           const logFlagVal: 0 | 1 = exportResultLine?.type === 'error' ? 0 : 0; // Error flag 0
           const exportLog: LogEntry = { timestamp, type: logType, flag: logFlagVal, text: logText };
           setLogEntries(prev => [...prev, exportLog]);

          if(commandLogOutput && exportResultLine){
             // Ensure timestamp and flag are set for the output line
             exportResultLine.timestamp = timestamp; // Use current execution timestamp
             exportResultLine.flag = logFlagVal;    // Use determined flag
             setHistory((prev) => [...prev, commandLogOutput, exportResultLine]);
          } else if (commandLogOutput) {
             // If exportResultLine is null (e.g., no logs), just show command
             setHistory((prev) => [...prev, commandLogOutput]);
          }
          clientHandled = true;
         }
         else if (finalCommandLower === 'pause') {
           const pauseOutput: OutputLine = {
             id: `pause-${timestamp}`,
             text: 'task stopped', // Changed from "Task paused."
             type: 'info',
             category: 'internal',
             timestamp: timestamp, // Set timestamp
             flag: 0, // Set flag
           };
            if(commandLogOutput){
               setHistory((prev) => [...prev, commandLogOutput, pauseOutput]);
            }
            const pauseLog: LogEntry = { timestamp, type: 'I', flag: 0, text: "Task paused." }; // Log still says "Task paused."
            setLogEntries(prev => [...prev, pauseLog]);
           // setIsRunning(false); // This will be handled in finally
           clientHandled = true; // Mark as client handled
         }
      }

      if (clientHandled) {
         if (finalCommandLower !== 'pause') setIsRunning(false); // Reset if not pause
         return;
      }

      executionResult = await executeCommand({
        userId: SIMULATED_USER_ID,
        command: finalCommand, // Use the processed command
        mode: category as CommandMode,
        addSuggestion, // Problematic in server actions
        addCustomCommand, // Problematic in server actions
        getCustomCommandAction, // Problematic in server actions
        currentLogEntries: logEntries, // Pass current log entries
        initialSuggestions,
        overridePermissionChecks: true, // Pass the override flag
      });

      const outputToDisplay = executionResult.outputLines
          .filter(line => line.id !== commandLogOutput?.id) // Avoid duplicating command log
          .map(line => ({
             ...line,
             // Ensure flag is explicitly set for log-style lines
             flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 0 : 0) : undefined)
           }));

       if(commandLogOutput){
         setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
       }

       if (executionResult.newLogEntries) {
          // Filter out duplicate log entries before adding
          const uniqueNewLogs = executionResult.newLogEntries.filter(
              newLog => !logEntries.some(existing => existing.timestamp === newLog.timestamp && existing.text === newLog.text)
          );
          setLogEntries(prev => [...prev, ...uniqueNewLogs]);
       }
       if (executionResult.toastInfo) {
            toast({
                title: "AI Notification",
                description: executionResult.toastInfo.message,
                variant: executionResult.toastInfo.variant || 'default',
            });
       }


    } catch (error) {
        errorOccurred = true; // Set error occurred flag
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
            timestamp: timestamp, // Set timestamp for error
            flag: 0, // Set flag for error
        };
         const errorLog: LogEntry = { timestamp, type: 'E', flag: 0, text: errorMsg }; // Set flag for error log
         // Ensure logs are updated even if executionResult is null
         if (executionResult && executionResult.newLogEntries) {
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         // Ensure commandLogOutput is created if it wasn't (e.g. error before classification)
         const cmdLog = commandLogOutput || { id: `cmd-err-${timestamp}`, text: originalCommand, type: 'command', category: 'internal', timestamp: timestamp };
         setHistory((prev) => [...prev, cmdLog, errorOutput]);

    } finally {
      // Use finalCommandLower for pause check
      if (finalCommandLower === 'pause' && !errorOccurred) {
          // isRunning is intentionally kept true for 'pause'
      } else {
          setIsRunning(false); // Set to false for all other cases (non-pause, or if an error occurred)
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
           if (cat === 'python') {
               combinedSuggestions.add('clipboard = get()');
           }
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-2 flex-wrap gap-4">
        <h1 className="text-lg font-semibold">SimShell</h1>
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

      <Accordion type="single" collapsible className="w-full mb-2">
        <AccordionItem value="sql-panel">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">SQL Direct Execution Panel</AccordionTrigger>
          <AccordionContent className="pt-2">
            <SqlInputPanel onSubmit={handleDirectSqlSubmit} disabled={isRunning} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

