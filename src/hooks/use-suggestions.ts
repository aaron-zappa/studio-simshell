
'use client';

import * as React from 'react';
import type { CommandMode } from '@/types/command-types'; // Assuming CommandMode is defined here
import type { CustomCommands } from './use-custom-commands'; // Import CustomCommands type

// Initial suggestions, will be mutable
const initialSuggestions: Record<string, string[]> = {
  internal: ['help', 'clear', 'mode', 'history', 'define', 'refine', 'add internal command', 'export log'], // Added export log
  python: ['print(', 'def ', 'import ', 'class ', 'if ', 'else:', 'elif ', 'for ', 'while ', 'try:', 'except:', 'return ', 'yield '],
  unix: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'echo', 'man', 'sudo'],
  windows: ['dir', 'cd', 'cls', 'mkdir', 'rmdir', 'copy', 'move', 'type', 'findstr', 'echo', 'help'],
  sql: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY'],
};


export const useSuggestions = () => {
    const [suggestions, setSuggestions] = React.useState(initialSuggestions);

    const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            // Ensure command names are added in lowercase for consistency
            const lowerCommand = command.toLowerCase();
             // Special case for 'add internal command' which needs quotes in usage
            const suggestionToAdd = lowerCommand.startsWith('add internal command') ? 'add internal command "<name>" <action>' : lowerCommand;

            if (!modeSuggestions.some(s => s.toLowerCase() === suggestionToAdd)) {
                return {
                    ...prev,
                    [mode]: [...modeSuggestions, suggestionToAdd].sort(), // Add and sort
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
