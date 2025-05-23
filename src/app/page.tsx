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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCustomCommands, type CustomCommands } from '@/hooks/use-custom-commands';
import { useSuggestions } from '@/hooks/use-suggestions';
import { executeCommand, type ExecuteCommandResult } from '@/lib/command-executor';
import { CommandMode, ALL_COMMAND_MODES } from '@/types/command-types';
import { exportLogFile } from '@/lib/logging';
import type { LogEntry } from '@/types/log-types';
import { classifyCommand, type CommandCategory } from '@/ai/flows/classify-command-flow';
import { useToast } from "@/hooks/use-toast";
import { cn, readClipboard } from '@/lib/utils';
import { getDbStatusAction } from '@/lib/database';
import { executeSqlScript } from '@/lib/sql-script-runner';
import { listAllTablesQuery } from '@/ai/flows/list-all-tables-flow';
import { getSqlScriptFiles } from '@/lib/file-actions';
import { Cpu, FlaskConical } from 'lucide-react';
import { getUserDetailsById } from '@/lib/users';

const SIMULATED_USER_ID = 1;

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [isTesting, setIsTesting] = React.useState<boolean>(false);
  const { toast } = useToast();

  const [selectedCategories, setSelectedCategories] = React.useState<CommandMode[]>(['internal', 'python']);
  const { suggestions, addSuggestion, initialSuggestions } = useSuggestions();
  const { customCommands, addCustomCommand, getCustomCommandAction } = useCustomCommands();

  const [sqlScriptFiles, setSqlScriptFiles] = React.useState<string[]>([]);
  const [selectedSqlScript, setSelectedSqlScript] = React.useState<string>("");

  const [currentUser, setCurrentUser] = React.useState<{ username: string; role: string }>({ username: 'Loading...', role: 'Loading...' });


  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const status = await getDbStatusAction();
        const timestamp = new Date().toISOString();
        let statusType: OutputLine['type'] = 'info';
        let logType: LogEntry['type'] = 'I';
        let logFlag: 0 | 1 = status.includes('nok') ? 1 : 0;

        if (status.includes("Database loaded with status ok (file: data/sim_shell.db, tables NOT ok (run 'init db'))")) {
          logFlag = 1;
          statusType = 'warning';
          logType = 'W';
        } else if (status.includes('nok')) {
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
          flag: 1,
        };
        setHistory(prev => [...prev, errorLine]);
        setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorLine.text }]);
      }

      try {
        const files = await getSqlScriptFiles();
        setSqlScriptFiles(files);
        if (files.length > 0) {
          setSelectedSqlScript(files[0]);
        }
      } catch (error) {
        console.error("Failed to fetch SQL script files:", error);
        toast({
          title: "Error",
          description: "Could not load SQL script files.",
          variant: "destructive",
        });
      }

      try {
        const userDetails = await getUserDetailsById(SIMULATED_USER_ID);
        if (userDetails) {
          setCurrentUser(userDetails);
        } else {
          console.warn(`Could not fetch details for user ID: ${SIMULATED_USER_ID}. Display prefix might be affected.`);
          setCurrentUser({ username: `User${SIMULATED_USER_ID}`, role: 'Unknown' });
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
        setCurrentUser({ username: `User${SIMULATED_USER_ID}`, role: 'Error Fetching Role' });
      }
    };

    fetchInitialData();
  }, [toast]);

  const handleCategoryChange = (category: CommandMode, checked: boolean | 'indeterminate') => {
    setSelectedCategories(prev =>
      checked
        ? [...prev, category]
        : prev.filter(c => c !== category)
    );
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
            issuer: currentUser
        };
        setHistory(prev => [...prev, commandLogOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'I', flag: 0, text: `Executing SQL script file: ${scriptFilename}` }]);

        try {
            const scriptResult = await executeSqlScript(scriptFilename);
            
            if (scriptResult.outputLines) {
                const outputToDisplay = scriptResult.outputLines.map(line => ({
                    ...line,
                    flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : 0)
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
                flag: 1,
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]);
        }
    } else {
        const commandLogOutput: OutputLine = {
            id: `cmd-sql-${timestamp}`,
            text: commandTrimmed,
            type: 'command',
            category: 'sql',
            timestamp: timestamp,
            issuer: currentUser
        };

        setHistory(prev => [...prev, commandLogOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'I', flag: 0, text: `Direct SQL command executed: ${commandTrimmed}` }]);

        try {
            const executionResult = await executeCommand({
                userId: SIMULATED_USER_ID,
                command: commandTrimmed,
                mode: 'sql',
                currentLogEntries: logEntries,
                initialSuggestions,
                customCommands: customCommands, // Pass the customCommands object
                overridePermissionChecks: true,
            });

            if (executionResult && executionResult.outputLines) {
                const outputToDisplay = executionResult.outputLines
                    .filter(line => line.id !== commandLogOutput?.id)
                    .map(line => ({
                        ...line,
                        flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : 0)
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
                const errorOutputLine: OutputLine = { id: `sql-exec-err-${errTimestamp}`, text: errorMsg, type: 'error', category: 'sql', timestamp: errTimestamp, flag: 1 };
                setHistory((prev) => [...prev, errorOutputLine]);
                setLogEntries(prev => [...prev, { timestamp: errTimestamp, type: 'E', flag: 1, text: errorMsg }]);
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
                flag: 1,
            };
            setHistory((prev) => [...prev, errorOutput]);
            setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]);
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
            flag: 1,
        };
        setHistory((prev) => [...prev, errorOutput]);
        setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: errorMsg }]);
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
    let finalCommandLower = ''; // Initialize here for wider scope
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
    
    finalCommandLower = finalCommand.toLowerCase(); // Assign here after potential modification


    let classificationResult: { category: CommandCategory; reasoning?: string | undefined } | null = null;
    let executionResult: ExecuteCommandResult | null = null;
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
             category: 'python', // Assuming clipboard = get() would be python if not internal
             timestamp: timestamp,
             issuer: currentUser
         };
         setHistory((prev) => [...prev, commandLogOutput]);
         setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: "Command execution skipped: Clipboard operation failed." }]);
         throw new Error("Command execution skipped: Clipboard operation failed.");
      }
       if (!finalCommand && !clipboardGetRegex.test(commandTrimmed) && commandTrimmed.length > 0) {
           commandLogOutput = {
             id: `cmd-empty-final-${timestamp}`,
             text: originalCommand,
             type: 'command',
             category: 'internal', // Default to internal if processed command is empty for other reasons
             timestamp: timestamp,
             issuer: currentUser
           };
           setHistory((prev) => [...prev, commandLogOutput]);
           setLogEntries(prev => [...prev, { timestamp, type: 'E', flag: 1, text: "Command execution skipped: Processed command is empty." }]);
           throw new Error("Command execution skipped: Processed command is empty.");
       }
       if (!finalCommand && commandTrimmed.length === 0) {
            // If the original command was empty, just do nothing and return
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
         text: finalCommand, // Log the potentially modified command (e.g., clipboard assignment)
         type: 'command',
         category: (category === 'ambiguous' || category === 'unknown') ? 'internal' : category,
         timestamp: timestamp,
         issuer: currentUser
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
          flag: 1,
        };
        setHistory((prev) => [...prev, commandLogOutput, ambiguousOutput]);
        const classificationLog: LogEntry = {
            timestamp,
            type: 'W', // Warning for classification issues
            flag: 1,
            text: `Command classification: ${category}. Reasoning: ${classificationReasoning || 'N/A'}. Original: '${originalCommand}', Processed: '${finalCommand}', Active: ${selectedCategories.join(', ')}`
        };
        setLogEntries(prev => [...prev, classificationLog]);
        setIsRunning(false);
        return;
      }

      // Client-side handling for specific internal commands
      let clientHandled = false;
      if (category === 'internal') {
         if (finalCommandLower === 'clear') {
          setHistory([]); // Clears the UI history
          const clearLog: LogEntry = { timestamp, type: 'I', flag: 0, text: "History cleared." };
          setLogEntries(prev => [...prev, clearLog]); // Log the clear action
          clientHandled = true;
         }
         // 'export log' is primarily client-side due to file download
         else if (finalCommandLower === 'export log') {
          const exportResultLine = exportLogFile(logEntries); // This function is client-side
           // Log the attempt (success/failure is logged by exportLogFile itself if it returns an OutputLine)
           const logText = exportResultLine ? exportResultLine.text : "Log export action attempted.";
           const logType: LogEntry['type'] = exportResultLine?.type === 'error' ? 'E' : 'I';
           const logFlagVal: 0 | 1 = exportResultLine?.type === 'error' ? 1 : 0;

           const exportLog: LogEntry = { timestamp, type: logType, flag: logFlagVal, text: logText };
           setLogEntries(prev => [...prev, exportLog]);

          if(commandLogOutput && exportResultLine){
             // Make sure the displayed line also gets a timestamp and flag if it's an error/info
             exportResultLine.timestamp = timestamp; // Use consistent timestamp for the event
             exportResultLine.flag = logFlagVal;
             setHistory((prev) => [...prev, commandLogOutput, exportResultLine]);
          } else if (commandLogOutput) {
             // If exportLogFile returns null or undefined (shouldn't happen with current impl)
             setHistory((prev) => [...prev, commandLogOutput]);
          }
          clientHandled = true;
         }
         else if (finalCommandLower === 'pause') {
           // 'pause' is largely a UI concept of stopping further processing
           const pauseOutput: OutputLine = {
             id: `pause-${timestamp}`,
             text: 'task stopped', // Changed from "Task paused."
             type: 'info',
             category: 'internal',
             timestamp: timestamp, // This makes it look like a log line
             flag: 0,
           };
            if(commandLogOutput){
               setHistory((prev) => [...prev, commandLogOutput, pauseOutput]);
            }
            const pauseLog: LogEntry = { timestamp, type: 'I', flag: 0, text: "Task paused." }; // Log the action
            setLogEntries(prev => [...prev, pauseLog]);
           clientHandled = true;
         }
      }

      if (clientHandled) {
         // For 'pause', we don't want to immediately set isRunning to false
         // because the 'finally' block will handle it.
         // For other client-handled commands, we can stop here.
         if (finalCommandLower !== 'pause') setIsRunning(false);
         return;
      }

      // If not client-handled, proceed to server-side execution
      executionResult = await executeCommand({
        userId: SIMULATED_USER_ID,
        command: finalCommand,
        mode: category as CommandMode, // Pass the classified category
        currentLogEntries: logEntries, // Pass current log entries
        initialSuggestions,
        customCommands: customCommands, // Pass the customCommands object
        overridePermissionChecks: true, // Passing the override flag
      });
      
      // Process results from server-side execution
      if (executionResult && executionResult.outputLines) {
          // Filter out the command echo if the server already included it (it shouldn't anymore)
          const outputToDisplay = executionResult.outputLines
              .filter(line => line.id !== commandLogOutput?.id) // Avoid duplicate command display
              .map(line => ({
                 ...line,
                 // Ensure flag is set, defaulting based on type if missing from server
                 flag: line.flag ?? ((line.type === 'info' || line.type === 'warning' || line.type === 'error') ? (line.type === 'error' ? 1 : (line.type === 'warning' ? 1 : 0)) : 0)
               }));

           // Add the original command log output, then the results
           if(commandLogOutput){
             setHistory((prev) => [...prev, commandLogOutput, ...outputToDisplay]);
           } else {
             // This case should ideally not happen if commandLogOutput is always created
             setHistory((prev) => [...prev, ...outputToDisplay]);
           }

           // Update log entries from server result
           if (executionResult.newLogEntries) {
              // Filter out duplicates if any (though server should ideally handle this)
              const uniqueNewLogs = executionResult.newLogEntries.filter(
                  newLog => !logEntries.some(existing => existing.timestamp === newLog.timestamp && existing.text === newLog.text)
              );
              setLogEntries(prev => [...prev, ...uniqueNewLogs]);
           }
           // Handle toast notifications requested by the server
           if (executionResult.toastInfo) {
                toast({
                    title: "AI Notification",
                    description: executionResult.toastInfo.message,
                    variant: executionResult.toastInfo.variant || 'default',
                });
           }
           // Handle new suggestions/commands if the server sent them
            if (executionResult.newSuggestions) {
                executionResult.newSuggestions.forEach(s => addSuggestion(s.mode, s.command));
            }
            if (executionResult.newCustomCommands) {
                executionResult.newCustomCommands.forEach(cc => addCustomCommand(cc.name, cc.action));
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
              category: 'internal', // Default to internal for this type of error
              timestamp: errTimestamp,
              flag: 1,
          };
          // Ensure commandLogOutput is added if it exists
          if (commandLogOutput) {
            setHistory((prev) => [...prev, commandLogOutput, errorOutputLine]);
          } else {
             // Fallback if commandLogOutput wasn't created (should be rare)
             const cmdFallbackLog: OutputLine = { id: `cmd-fallback-${errTimestamp}`, text: originalCommand || "[unknown command]", type: 'command', category: 'internal', timestamp: errTimestamp, issuer: currentUser };
             setHistory((prev) => [...prev, cmdFallbackLog, errorOutputLine]);
          }
          setLogEntries(prev => [...prev, { timestamp: errTimestamp, type: 'E', flag: 1, text: errorMsg }]);
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
            category: 'internal', // Default for unhandled errors
            timestamp: timestamp,
            flag: 1,
        };
         // Log the error
         const errorLog: LogEntry = { timestamp, type: 'E', flag: 1, text: errorMsg };
         // If executionResult has logs (e.g., from partial server execution before error), include them
         if (executionResult && executionResult.newLogEntries) {
             setLogEntries([...executionResult.newLogEntries, errorLog]);
         } else {
             setLogEntries(prev => [...prev, errorLog]);
         }
         // Ensure the command that caused the error is shown
         const cmdLog = commandLogOutput || { id: `cmd-err-${timestamp}`, text: originalCommand, type: 'command', category: 'internal', timestamp: timestamp, issuer: currentUser };
         setHistory((prev) => [...prev, cmdLog, errorOutput]);

    } finally {
      // Use finalCommandLower for pause check
      if (finalCommandLower === 'pause' && !errorOccurred) {
        // For 'pause', the 'task stopped' message is shown, and isRunning is kept true
        // effectively waiting for the user to enter another command or for a timeout if implemented.
        // The UI itself doesn't "stop" in a way that requires setIsRunning(false) immediately.
        // If 'pause' was to truly halt background tasks, that logic would be elsewhere.
      } else {
          setIsRunning(false); // Set to false for other commands or if an error occurred
      }
    }
  };

   const filteredSuggestionsForInput = React.useMemo(() => {
       const combinedSuggestions = new Set<string>();
        selectedCategories.forEach(cat => {
           (suggestions[cat] || []).forEach(sug => combinedSuggestions.add(sug));
           // Add custom internal commands to suggestions if 'internal' is active
           if (cat === 'internal') {
                Object.keys(customCommands).forEach(cmdName => combinedSuggestions.add(cmdName));
           }
           // Add "clipboard = get()" for python if active
           if (cat === 'python') {
               combinedSuggestions.add('clipboard = get()');
           }
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  const handleRunCategoryTests = async () => {
    if (isRunning || isTesting) return;

    setIsTesting(true);
    setIsRunning(true);

    const testQueue: { command: string, category: CommandMode | 'sql' }[] = []; // Allow 'sql' specifically for direct submission

    selectedCategories.forEach(category => {
      const testOutputStart: OutputLine = {
        id: `test-start-${category}-${Date.now()}`,
        text: `--- Starting tests for category: ${category} ---`,
        type: 'info',
        category: 'internal',
        timestamp: new Date().toISOString(),
        flag: 0,
      };
      setHistory(prev => [...prev, testOutputStart]);
      setLogEntries(prev => [...prev, { timestamp: new Date().toISOString(), type: 'I', flag: 0, text: `Starting tests for category: ${category}` }]);

      switch (category) {
        case 'internal':
          testQueue.push({ command: 'help', category });
          testQueue.push({ command: 'list py vars', category });
          testQueue.push({ command: 'show requirements', category });
          testQueue.push({ command: 'ai SimShell test', category });
          break;
        case 'python':
          testQueue.push({ command: 'print("SimShell Python test")', category });
          break;
        case 'unix':
          testQueue.push({ command: 'echo "SimShell Unix test"', category });
          break;
        case 'windows':
          testQueue.push({ command: 'echo "SimShell Windows test"', category });
          break;
        case 'sql':
          // SQL commands will be handled by handleDirectSqlSubmit
          testQueue.push({ command: 'SELECT 1+1 AS test_calculation;', category: 'sql' });
          testQueue.push({ command: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", category: 'sql' });
          break;
        case 'excel':
          testQueue.push({ command: 'SUM(10,20,30)', category });
          break;
        case 'typescript':
          testQueue.push({ command: 'console.log("SimShell TypeScript test");', category });
          break;
      }
    });

    for (const testItem of testQueue) {
      // Display which command is being tested
      const testCommandOutput: OutputLine = {
        id: `test-cmd-${testItem.category}-${testItem.command.replace(/\s/g, '_')}-${Date.now()}`,
        text: `Testing command: ${testItem.command}`,
        type: 'info', // Use 'info' to distinguish from actual command output style
        category: 'internal', // Logged as an internal action
        timestamp: new Date().toISOString(),
        flag: 0 // Or another appropriate flag
      };
      setHistory(prev => [...prev, testCommandOutput]);
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for readability

      if (testItem.category === 'sql') {
        await handleDirectSqlSubmit(testItem.command);
      } else {
        await handleCommandSubmit(testItem.command);
      }
      await new Promise(resolve => setTimeout(resolve, 300)); // Delay after command execution
    }
    
    // Final message
    const testOutputEnd: OutputLine = {
        id: `test-end-all-${Date.now()}`,
        text: `--- All category tests finished ---`,
        type: 'info',
        category: 'internal',
        timestamp: new Date().toISOString(),
        flag: 0,
      };
    setHistory(prev => [...prev, testOutputEnd]);
    setLogEntries(prev => [...prev, { timestamp: new Date().toISOString(), type: 'I', flag: 0, text: `All category tests finished.` }]);

    setIsTesting(false);
    setIsRunning(false);
  };


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
      <TooltipProvider>
        <header className="flex items-center justify-between mb-2 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {/* Updated SimShell logo and title display */}
            <Cpu className="h-7 w-7 text-primary" data-ai-hint="chip circuit" />
            <h1 className="text-lg font-semibold">SimShell</h1> {/* text-lg instead of text-xl */}
            {/* Test Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRunCategoryTests}
                  disabled={isRunning || isTesting || selectedCategories.length === 0}
                  className="h-7 w-7" // Smaller icon button
                >
                  <FlaskConical className="h-4 w-4" data-ai-hint="science experiment" />
                  <span className="sr-only">Run Tests</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Run predefined tests for active categories</p>
              </TooltipContent>
            </Tooltip>
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
                  disabled={isRunning || isTesting} // Disable if tests or command is running
                />
                <Label htmlFor={`category-${category}`} className="text-sm font-normal capitalize">
                  {category}
                </Label>
              </div>
            ))}
          </div>
        </header>
      </TooltipProvider>

      {/* Accordion for SQL Input Panel */}
      <Accordion type="single" collapsible className="w-full mb-2">
        <AccordionItem value="sql-panel">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">SQL Direct Execution Panel</AccordionTrigger>
          <AccordionContent className="pt-2"> {/* Added padding-top to content */}
            <div className="flex flex-col space-y-2">
              <SqlInputPanel onSubmit={handleDirectSqlSubmit} disabled={isRunning || isTesting} />
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <Button
                  onClick={handleListAllTablesClick}
                  disabled={isRunning || isTesting}
                  variant="outline"
                  size="sm"
                >
                  List All Tables
                </Button>
                {/* SQL Script File Selector and Runner */}
                <div className="flex items-center space-x-2">
                  <Select value={selectedSqlScript} onValueChange={setSelectedSqlScript} disabled={isRunning || isTesting || sqlScriptFiles.length === 0}>
                    <SelectTrigger className="w-[200px] h-9 text-sm" disabled={isRunning || isTesting || sqlScriptFiles.length === 0}>
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
                    disabled={isRunning || isTesting || !selectedSqlScript}
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

      {/* Output Display - Adjusted flex properties for sizing */}
       <main className="flex-grow-[0.6] flex-shrink overflow-hidden mb-2"> {/* Adjusted flex-grow */}
        <OutputDisplay history={history} className="h-full" />
      </main>

      {/* Command Input Footer - Remains the same */}
       <footer className="shrink-0">
        <CommandInput
            onSubmit={handleCommandSubmit}
            suggestions={filteredSuggestionsForInput}
            disabled={isRunning || isTesting} // Disable if tests or command is running
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

