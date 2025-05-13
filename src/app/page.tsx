// src/app/page.tsx
// src/app/page.tsx
"use client";

import * as React from 'react';
import { CommandInput } from '@/components/command-input';
import { OutputDisplay, type OutputLine } from '@/components/output-display';
import { SqlInputPanel } from '@/components/sql-input-panel';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
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
import { executeSqlScript } from '@/lib/sql-script-runner';
import { listAllTablesQuery } from '@/ai/flows/list-all-tables-flow';
import { getSqlScriptFiles } from '@/lib/file-actions'; // Import new server action
import { Cpu } from 'lucide-react'; // Import Cpu icon

const SIMULATED_USER_ID = 1; // Example user ID

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const { toast } = useToast();

  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(['internal']);
  const { suggestions, addSuggestion, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();

  const [sqlScriptFiles, setSqlScriptFiles] = React.useState<string[]>([]);
  const [selectedSqlScript, setSelectedSqlScript] = React.useState<string>("");

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
                logFlag = 1; // Set flag to 1 for Error
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
                flag: 1, // Set flag to 1 for Error
             };
             setHistory(prev => [...prev, errorLine]);
             setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorLine.text }]); // Set flag to 1 for Error
        }
    };
    fetchDbStatus();

    const fetchSqlFiles = async () => {
      try {
        const files = await getSqlScriptFiles();
        setSqlScriptFiles(files);
        if (files.length > 0) {
          setSelectedSqlScript(files[0]); // Select the first file by default
        }
      } catch (error) {
        console.error("Failed to fetch SQL script files:", error);
        toast({
          title: "Error",
          description: "Could not load SQL script files.",
          variant: "destructive",
        });
      }
    };
    fetchSqlFiles();
  }, [toast]);

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
            text: commandTrimmed, 
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
                    flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : undefined)
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
                flag: 1, // Error flag
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]); // Error flag
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
                mode: 'sql', // Direct SQL mode
                currentLogEntries: logEntries,
                initialSuggestions,
                getCustomCommandAction,
                overridePermissionChecks: true, 
            });

            if (executionResult && executionResult.outputLines) {
                const outputToDisplay = executionResult.outputLines
                    .filter(line => line.id !== commandLogOutput?.id)
                    .map(line => ({
                        ...line,
                        flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : undefined)
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
            } else {
                console.error("Direct SQL execution did not return expected result object or outputLines:", executionResult);
                const errorMsg = "SQL execution failed to produce a valid result.";
                const errTimestamp = new Date().toISOString();
                const errorOutputLine: OutputLine = { id: `sql-exec-err-${errTimestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp: errTimestamp, flag: 1 }; // Error flag
                setHistory((prev) => [...prev, errorOutputLine]);
                setLogEntries(prev => [...prev, { timestamp: errTimestamp, type: 'E', flag: 1, text: errorMsg }]); // Error flag
                toast({ title: "SQL Execution Error", description: errorMsg, variant: "destructive" });
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
                flag: 1, // Error flag
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]); // Error flag
        }
    }
    setIsRunning(false);
  };

  const handleListAllTablesClick = async () => {
    try {
        const { sqlQuery } = await listAllTablesQuery();
        await handleDirectSqlSubmit(sqlQuery);
    } catch (error) {
        console.error("Error executing list all tables flow:", error);
        const timestamp = new Date().toISOString();
        const errorMsg = `Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`;
        toast({
            title: "List Tables Error",
            description: errorMsg,
            variant: "destructive",
        });
        const errorOutput: OutputLine = {
            id: `list-tables-error-${timestamp}`,
            text: errorMsg,
            type: 'error',
            category: 'internal', 
            timestamp: timestamp,
            flag: 1, // Error flag
        };
        setHistory((prev) => [...prev, errorOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]); // Error flag
    }
  };

  const handleRunSelectedScript = async () => {
    if (selectedSqlScript) {
      await handleDirectSqlSubmit(`@sql:${selectedSqlScript}`);
    } else {
      toast({
        title: "No Script Selected",
        description: "Please select an SQL script from the dropdown.",
        variant: "destructive",
      });
    }
  };


  const handleCommandSubmit = async (originalCommand: string) => {
    const commandTrimmed = originalCommand.trim();
    const timestamp = new Date().toISOString();
    let commandLogOutput: OutputLine | null = null;
    let finalCommandLower = ''; 
    setIsRunning(true);

    let finalCommand = commandTrimmed;
    let clipboardReadError: string | null = null;

    const clipboardGetRegex = /^\s*clipboard\s*=\s*get\(\)\s*$/i;
    if (clipboardGetRegex.test(commandTrimmed)) {
       try {
         const clipboardContent = await readClipboard();
         const escapedContent = clipboardContent.replace(/"/g, '\\"'); 
         finalCommand = `clipboard = "${escapedContent}"`;
       } catch (error) {
         console.error("Clipboard read error:", error);
         clipboardReadError = error instanceof Error ? error.message : 'Unknown clipboard error';
         finalCommand = ''; 
       }
    }
    
    finalCommandLower = finalCommand.toLowerCase(); 


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
      if (!finalCommand && clipboardGetRegex.test(commandTrimmed)) { 
         commandLogOutput = {
             id: `cmd-clipboard-skip-${timestamp}`,
             text: originalCommand, 
             type: 'command',
             category: 'python', 
             timestamp: timestamp
         };
         setHistory((prev) => [...prev, commandLogOutput]);
         setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: "Command execution skipped: Clipboard operation failed." }]); // Error flag
         throw new Error("Command execution skipped: Clipboard operation failed.");
      }
       if (!finalCommand && !clipboardGetRegex.test(commandTrimmed) && commandTrimmed.length > 0) {
           commandLogOutput = {
             id: `cmd-empty-final-${timestamp}`,
             text: originalCommand,
             type: 'command',
             category: 'internal', 
             timestamp: timestamp
           };
           setHistory((prev) => [...prev, commandLogOutput]);
           setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: "Command execution skipped: Processed command is empty." }]); // Error flag
           throw new Error("Command execution skipped: Processed command is empty.");
       }
       if (!finalCommand && commandTrimmed.length === 0) { 
            setIsRunning(false);
            return;
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
          flag: 1, // Error flag
        };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        const classificationLog: LogEntry = {
            timestamp,
            type: 'W', 
            flag: 1,   
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
          const exportResultLine = exportLogFile(logEntries); 
           const logText = exportResultLine ? exportResultLine.text : "Log export action attempted.";
           const logType: LogEntry['type'] = exportResultLine?.type === 'error' ? 'E' : 'I';
           const logFlagVal: 0 | 1 = exportResultLine?.type === 'error' ? 1 : 0; 
           const exportLog: LogEntry = { timestamp, type: logType, flag: logFlagVal, text: logText };
           setLogEntries(prev => [...prev, exportLog]);

          if(commandLogOutput && exportResultLine){
             exportResultLine.timestamp = timestamp; 
             exportResultLine.flag = logFlagVal;    
             setHistory((prev) => [...prev, commandLogOutput, exportResultLine]);
          } else if (commandLogOutput) {
             setHistory((prev) => [...prev, commandLogOutput]);
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
        currentLogEntries: logEntries, 
        initialSuggestions,
        getCustomCommandAction,
        overridePermissionChecks: true, 
      });
      
      if (executionResult && executionResult.outputLines) {
          const outputToDisplay = executionResult.outputLines
              .filter(line => line.id !== commandLogOutput?.id) 
              .map(line => ({
                 ...line,
                 flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : undefined)
               }));

           if(commandLogOutput){
             setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
           } else {
             setHistory((prev) => [...prev, ...outputToDisplay]);
           }

           if (executionResult.newLogEntries) {
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
      } else {
          // Handle the case where executionResult or executionResult.outputLines is not as expected
          errorOccurred = true;
          console.error("executeCommand did not return the expected result object or outputLines:", executionResult);
          const errorMsg = "Command execution failed to produce a valid result.";
          const errTimestamp = new Date().toISOString(); // Use a new timestamp for this specific error
          const errorOutputLine: OutputLine = {
              id: `exec-result-err-${errTimestamp}`,
              text: errorMsg,
              type: 'error',
              category: 'internal',
              timestamp: errTimestamp,
              flag: 1, // Error flag
          };
          if (commandLogOutput) {
            setHistory((prev) => [...prev, commandLogOutput, errorOutputLine]);
          } else {
             // If commandLogOutput itself is null (should be rare unless originalCommand was empty and not caught)
             const cmdFallbackLog: OutputLine = { id: `cmd-fallback-${errTimestamp}`, text: originalCommand || "[unknown command]", type: 'command', category: 'internal', timestamp: errTimestamp };
             setHistory((prev) => [...prev, cmdFallbackLog, errorOutputLine]);
          }
          setLogEntries(prev => [...prev, { timestamp: errTimestamp, type: 'E', flag: 1, text: errorMsg }]); // Error flag
          toast({ title: "Execution Error", description: errorMsg, variant: "destructive" });
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
            flag: 1,  // Error flag
        };
         const errorLog: LogEntry = { timestamp, type: 'E', flag: 1, text: errorMsg }; // Error flag
         if (executionResult && executionResult.newLogEntries) { // Check if executionResult is not null
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         const cmdLog = commandLogOutput || { id: `cmd-err-${timestamp}`, text: originalCommand, type: 'command', category: 'internal', timestamp: timestamp };
         setHistory((prev) => [...prev, cmdLog, errorOutput]);

    } finally {
      if (finalCommandLower === 'pause' && !errorOccurred) {
        // Do nothing special, setIsRunning(false) is handled by the client-side nature of 'pause' effectively
      } else {
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
        <div className="flex items-center gap-2">
          <Cpu className="h-7 w-7 text-primary" data-ai-hint="chip circuit" />
          <h1 className="text-lg font-semibold">SimShell</h1>
        </div>
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
            <div className="flex flex-col space-y-2">
              <SqlInputPanel onSubmit={handleDirectSqlSubmit} disabled={isRunning} />
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <Button 
                  onClick={handleListAllTablesClick} 
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                >
                  List All Tables
                </Button>
                <div className="flex items-center space-x-2">
                  <Select value={selectedSqlScript} onValueChange={setSelectedSqlScript} disabled={isRunning || sqlScriptFiles.length === 0}>
                    <SelectTrigger className="w-[200px] h-9 text-sm" disabled={isRunning || sqlScriptFiles.length === 0}>
                      <SelectValue placeholder="Select script" />
                    </SelectTrigger>
                    <SelectContent>
                      {sqlScriptFiles.map((file) => (
                        <SelectItem key={file} value={file}>
                          {file}
                        </SelectItem>
                      ))}
                      {sqlScriptFiles.length === 0 && <SelectItem value="no-scripts" disabled>No scripts found</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleRunSelectedScript} 
                    disabled={isRunning || !selectedSqlScript}
                    variant="outline"
                    size="sm"
                  >
                    Run Selected Script
                  </Button>
                </div>
              </div>
            </div>
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




