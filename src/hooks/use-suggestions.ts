'use client';

import * as React from 'react';
import type { CommandMode } from '@/types/command-types';
import type { CustomCommands } from './use-custom-commands';

// Initial suggestions, will be mutable
const initialSuggestionsData: Record<CommandMode, string[]> = {
  internal: ['help', 'clear', 'mode', 'history', 'define', 'refine', 'add_int_cmd <short> <name> "<description>" <whatToDo>', 'export log', 'pause', 'create sqlite <filename.db>', 'show requirements'],
  python: ['print(', 'def ', 'import ', 'class ', 'if ', 'else:', 'elif ', 'for ', 'while ', 'try:', 'except:', 'return ', 'yield '],
  unix: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'echo', 'man', 'sudo'],
  windows: ['dir', 'cd', 'cls', 'mkdir', 'rmdir', 'copy', 'move', 'type', 'findstr', 'echo', 'help'],
  sql: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY'],
  excel: ['SUM(', 'AVERAGE(', 'COUNT(', 'MAX(', 'MIN(', 'IF(', 'VLOOKUP(', 'HLOOKUP(', 'INDEX(', 'MATCH('],
};


export const useSuggestions = () => {
    const [suggestions, setSuggestions] = React.useState(initialSuggestionsData);
    const initialSuggestions = React.useMemo(() => initialSuggestionsData, []);


    // Add suggestion still needs a mode context, but this might be determined differently now
     const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            const lowerCommand = command.toLowerCase();
            let suggestionToAdd = lowerCommand;

            // Special format for add_int_cmd suggestion itself
            if (mode === 'internal' && lowerCommand.startsWith('add_int_cmd')) {
                suggestionToAdd = 'add_int_cmd <short> <name> "<description>" <whatToDo>';
            }

            if (!modeSuggestions.some(s => s.toLowerCase() === suggestionToAdd.toLowerCase())) {
                return {
                    ...prev,
                    [mode]: [...modeSuggestions, suggestionToAdd].sort(),
                };
            }
            return prev;
        });
    }, []);

    // Function to get all suggestions combined, including custom internal commands
    const getAllSuggestions = React.useCallback((customInternalCommands: CustomCommands): string[] => {
        const allSugs = new Set<string>();

        // Add all suggestions from all modes
        Object.values(suggestions).forEach(modeSugs => {
            modeSugs.forEach(sug => allSugs.add(sug));
        });

        // Add custom internal command names
        Object.keys(customInternalCommands).forEach(cmdName => {
             // Ensure we add the actual command name, not a placeholder format
             if (!cmdName.startsWith('add_int_cmd <short>')) {
                allSugs.add(cmdName);
             }
        });


        return Array.from(allSugs).sort(); // Return sorted array of unique suggestions
    }, [suggestions]);


    return { suggestions, addSuggestion, getAllSuggestions, initialSuggestions }; // Export getAllSuggestions
};
