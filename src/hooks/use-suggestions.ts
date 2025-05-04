
'use client';

import * as React from 'react';
import type { CommandMode } from '@/types/command-types'; // Assuming CommandMode is defined here
import type { CustomCommands } from './use-custom-commands'; // Import CustomCommands type

// Initial suggestions, will be mutable
const initialSuggestionsData: Record<string, string[]> = {
  // Updated 'add internal command' suggestion format to include <short> and add 'create sqlite'
  internal: ['help', 'clear', 'mode', 'history', 'define', 'refine', 'add_int_cmd <short> <name> "<description>" <whatToDo>', 'export log', 'pause', 'create sqlite <filename.db>'],
  python: ['print(', 'def ', 'import ', 'class ', 'if ', 'else:', 'elif ', 'for ', 'while ', 'try:', 'except:', 'return ', 'yield '],
  unix: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'echo', 'man', 'sudo'],
  windows: ['dir', 'cd', 'cls', 'mkdir', 'rmdir', 'copy', 'move', 'type', 'findstr', 'echo', 'help'],
  sql: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY'],
  excel: ['SUM(', 'AVERAGE(', 'COUNT(', 'MAX(', 'MIN(', 'IF(', 'VLOOKUP(', 'HLOOKUP(', 'INDEX(', 'MATCH('], // Added Excel mode
};


export const useSuggestions = () => {
    // Use state initialized with the data object
    const [suggestions, setSuggestions] = React.useState(initialSuggestionsData);

    // Keep a reference to the initial static data if needed elsewhere (e.g., for mode checking)
    const initialSuggestions = React.useMemo(() => initialSuggestionsData, []);


    const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            // Ensure command names are added in lowercase for consistency in checking duplicates
            const lowerCommand = command.toLowerCase();

            // Determine the correct suggestion format based on the command being added
            let suggestionToAdd = lowerCommand;
            if (mode === 'internal' && lowerCommand.startsWith('add_int_cmd')) { // Check mode specifically for this format
                // Specific format for the add command suggestion itself
                suggestionToAdd = 'add_int_cmd <short> <name> "<description>" <whatToDo>';
            } else {
                 // For other commands added (like custom ones), use the actual command name
                 suggestionToAdd = lowerCommand;
            }


            // Check if the exact suggestion (considering format) already exists
            if (!modeSuggestions.some(s => s.toLowerCase() === suggestionToAdd.toLowerCase())) {
                 // Add the suggestion format or the command name itself
                return {
                    ...prev,
                    // Add the appropriate string and sort
                    [mode]: [...modeSuggestions, suggestionToAdd].sort(),
                };
            }
            return prev;
        });
    }, []);

     // Function to get suggestions for the current mode, including custom ones
     const getCurrentSuggestions = React.useCallback((mode: CommandMode, customInternalCommands: CustomCommands) => {
        const baseSuggestions = suggestions[mode] || [];
        if (mode === 'internal') {
            // Combine base internal suggestions with custom command names
            // Ensure no duplicates and sort
            const combined = [...new Set([...baseSuggestions, ...Object.keys(customInternalCommands)])].sort();
            return combined;
        }
        return baseSuggestions;
     }, [suggestions]);


    return { suggestions, addSuggestion, getCurrentSuggestions, initialSuggestions }; // Export initialSuggestions too
};

