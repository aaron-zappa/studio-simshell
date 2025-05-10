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

const SIMULATED_USER_ID = 2;

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

  const handleDirectSqlSubmit = async (sqlCommand: string) => {
    const commandTrimmed = sqlCommand.trim();
    if (!commandTrimmed) return;

    setIsRunning(true);
    const timestamp = new Date().toISOString();
    
    const commandLogOutput: OutputLine = {
        id: `cmd-sql-${timestamp}`,
        text: commandTrimmed,
        type: 'command',
        category: 'sql',
        timestamp: timestamp,
    };

    setHistory(prev => [...prev, commandLogOutput]);
    // Log entry for the command itself
    setLogEntries(prev => [...prev, { timestamp, type: 'I', flag: 0, text: `Direct SQL command executed: ${commandTrimmed}` }]);


    try {
        const executionResult = await executeCommand({
            userId: SIMULATED_USER_ID,
            command: commandTrimmed,
            mode: 'sql', // Directly set mode to SQL
            addSuggestion,
            addCustomCommand,
            getCustomCommandAction,
            currentLogEntries: logEntries,
            initialSuggestions,
        });

        const outputToDisplay = executionResult.outputLines
            .filter(line => line.id !== commandLogOutput?.id) // Already added command log
            .map(line => ({
                ...line,
                flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? 0 : undefined)
            }));
        
        setHistory((prev) => [...prev, ...outputToDisplay]);

        if (executionResult.newLogEntries) {
            setLogEntries(executionResult.newLogEntries);
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
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            category: 'sql',
            timestamp: timestamp,
            flag: 0,
        };
        setHistory((prev) => [...prev, errorOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 0, text: errorMsg }]);
    } finally {
        setIsRunning(false);
    }
  };


  const handleCommandSubmit = async (originalCommand: string) => {
    const commandTrimmed = originalCommand.trim();
    const timestamp = new Date().toISOString();
    let commandLogOutput: OutputLine | null = null;
    setIsRunning(true);

    let finalCommand = commandTrimmed;
    let finalCommandLower: string = '';
    let clipboardReadError: string | null = null;

    const clipboardGetRegex = /^\s*clipboard\s*=\s*get\(\)\s*$/i;
    if (clipboardGetRegex.test(commandTrimmed)) {
       try {
         const clipboardContent = await readClipboard();
         const escapedContent = clipboardContent.replace(/"/g, '\\"');
         finalCommand = `clipboard = "${escapedContent}"`;
         finalCommandLower = finalCommand.toLowerCase();
       } catch (error) {
         console.error("Clipboard read error:", error);
         clipboardReadError = error instanceof Error ? error.message : 'Unknown clipboard error';
         finalCommand = '';
         finalCommandLower = '';
       }
    } else {
        finalCommandLower = finalCommand.toLowerCase();
    }

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
      if (!finalCommand) {
         commandLogOutput = {
             id: `cmd-clipboard-skip-${timestamp}`,
             text: originalCommand,
             type: 'command',
             category: 'python',
             timestamp: timestamp
         };
         setHistory((prev) => [...prev, commandLogOutput]);
         throw new Error("Command execution skipped due to clipboard read failure.");
      }

      classificationResult = await classifyCommand({
          command: finalCommand,
          activeCategories: selectedCategories
      });
      const category: CommandCategory = classificationResult.category;
      const classificationReasoning = classificationResult.reasoning;

      commandLogOutput = {
         id: `cmd-${timestamp}`,
         text: originalCommand,
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
            type: 'W',
            flag: 0,
            text: ambiguousOutput.text
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
          const exportResultLine = exportLogFile(logEntries);
          const logText = exportResultLine ? exportResultLine.text : "Attempted log export.";
          const logType = exportResultLine?.type === 'error' ? 'E' : 'I';
          const logFlagVal: 0 | 1 = exportResultLine?.type === 'error' ? 0 : 0;
          const exportLog: LogEntry = { timestamp, type: logType, flag: logFlagVal, text: logText };
          setLogEntries(prev => [...prev, exportLog]);
          if(commandLogOutput && exportResultLine){
             if(exportResultLine.type === 'error' || exportResultLine.type === 'info'){
                 exportResultLine.timestamp = timestamp;
                 exportResultLine.flag = logFlagVal;
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
             flag: 0,
           };
            if(commandLogOutput){
               setHistory((prev) => [...prev, commandLogOutput, pauseOutput]);
            }
            const pauseLog: LogEntry = { timestamp, type: 'I', flag: 0, text: "Task paused." };
            setLogEntries(prev => [...prev, pauseLog]);
           setIsRunning(false);
           clientHandled = true;
         }
      }

      if (clientHandled) {
         if (finalCommandLower !== 'pause') setIsRunning(false);
         return;
      }

      executionResult = await executeCommand({
        userId: SIMULATED_USER_ID,
        command: finalCommand,
        mode: category as CommandMode,
        addSuggestion,
        addCustomCommand,
        getCustomCommandAction,
        currentLogEntries: logEntries,
        initialSuggestions
      });

      const outputToDisplay = executionResult.outputLines
          .filter(line => line.id !== commandLogOutput?.id)
          .map(line => ({
             ...line,
             flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? 0 : undefined)
           }));

       if(commandLogOutput){
         setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
       }

       if (executionResult.newLogEntries) {
          setLogEntries(executionResult.newLogEntries);
       }

       if (executionResult.toastInfo) {
            toast({
                title: "AI Notification",
                description: executionResult.toastInfo.message,
                variant: executionResult.toastInfo.variant || 'default',
            });
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
            flag: 0,
        };
         const errorLog: LogEntry = { timestamp, type: 'E', flag: 0, text: errorMsg };
         if (executionResult?.newLogEntries) {
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         const cmdLog = commandLogOutput || { id: `cmd-err-${timestamp}`, text: originalCommand, type: 'command', category: 'internal', timestamp: timestamp };
         setHistory((prev) => [...prev, cmdLog, errorOutput]);

    } finally {
      if (finalCommandLower !== 'pause') {
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

       <main className="flex-grow-[0.6] flex-shrink overflow-hidden mb-2">
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
