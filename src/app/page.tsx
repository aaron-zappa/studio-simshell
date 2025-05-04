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

export default function Home() {
  const [history, setHistory] = React.useState<OutputLine[]>([]);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
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
    const timestamp = new Date().toISOString();
    let commandLogOutput: OutputLine | null = null;
    setIsRunning(true);

    let classificationResult: { category: CommandCategory; reasoning?: string | undefined } | null = null;
    let executionResult: { outputLines: OutputLine[]; newLogEntries?: LogEntry[] | undefined } | null = null;
    let errorOccurred = false;

    try {
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
      if (category === 'internal') {
         if (commandLower === 'clear') {
          setHistory([]);
          const clearLog: LogEntry = { timestamp, type: 'I', text: "History cleared." };
          setLogEntries(prev => [...prev, clearLog]);
          clientHandled = true;
         }
         else if (commandLower === 'export log') {
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
         else if (commandLower === 'pause') {
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
      }


      if (clientHandled) {
         if (commandLower !== 'pause') setIsRunning(false);
         return;
      }

      executionResult = await executeCommand({
        command,
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
         if(commandLogOutput){
             setHistory((prev) => [...prev, commandLogOutput, errorOutput]);
         } else {
             const genericCommandLog: OutputLine = { id: `cmd-err-${timestamp}`, text: command, type: 'command', category: 'internal', timestamp: timestamp };
             setHistory((prev) => [...prev, genericCommandLog, errorOutput]);
         }

    } finally {
      if (commandLower !== 'pause' && !errorOccurred) {
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
        });
       return Array.from(combinedSuggestions).sort();
   }, [selectedCategories, suggestions, customCommands]);


  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-background">
       <header className="flex items-center justify-between mb-2 flex-wrap gap-4"> {/* Reduced bottom margin */}
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

       <main className="flex-grow-[0.8] flex-shrink overflow-hidden mb-4"> {/* No extra margin-bottom needed now */}
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
