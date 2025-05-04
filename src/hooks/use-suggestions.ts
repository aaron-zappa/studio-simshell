// src/hooks/use-suggestions.ts
// src/hooks/use-suggestions.ts
'use client';

import * as React from 'react';
import type { CommandMode } from '@/types/command-types';
import type { CustomCommands } from './use-custom-commands';

// Initial suggestions, will be mutable
const initialSuggestionsData: Record<CommandMode, string[]> = {
  internal: [
      'help',
      'clear',
      // 'mode', // Removed as it's informational now
      'history',
      'define',
      'refine',
      'add int_cmd <short> <name> "<description>" <whatToDo>', // Updated old command suggestion
      'add ai_tool <toolname> "<args_description>" "<description>"', // Corrected AI tool suggestion order
      'set ai_tool <name> active <0|1>', // Added new set command suggestion
      'export log',
      'pause',
      'create sqlite <filename.db>',
      'show requirements',
      'persist memory db to <filename.db>',
      'init', // Added general init command
      'init db', // Keep specific init db as well
      'list py vars', // Added new command
      'ai <inputtext with {varname}>', // Updated AI command suggestion
    ],
  python: [
      'print(', 'def ', 'import ', 'class ', 'if ', 'else:', 'elif ', 'for ', 'while ', 'try:', 'except:', 'return ', 'yield ',
      'clipboard = get()' // Add clipboard suggestion here
    ],
  unix: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'echo', 'man', 'sudo'],
  windows: ['dir', 'cd', 'cls', 'mkdir', 'rmdir', 'copy', 'move', 'type', 'findstr', 'echo', 'help'],
  sql: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY', 'SELECT 1;'], // Added SELECT 1;
  excel: ['SUM(', 'AVERAGE(', 'COUNT(', 'MAX(', 'MIN(', 'IF(', 'VLOOKUP(', 'HLOOKUP(', 'INDEX(', 'MATCH('],
};


export const useSuggestions = () => {
    const [suggestions, setSuggestions] = React.useState(initialSuggestionsData);
    const initialSuggestions = React.useMemo(() => initialSuggestionsData, []);


    // Add suggestion still needs a mode context
     const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            const lowerCommand = command.toLowerCase();
            let suggestionToAdd = lowerCommand;

            // Special format for add_int_cmd suggestion itself
            if (mode === 'internal' && lowerCommand.startsWith('add int_cmd')) {
                suggestionToAdd = 'add int_cmd <short> <name> "<description>" <whatToDo>';
            }
            // Corrected format for add_ai_tool suggestion
             if (mode === 'internal' && lowerCommand.startsWith('add ai_tool')) {
                 suggestionToAdd = 'add ai_tool <toolname> "<args_description>" "<description>"'; // Corrected order
             }
             // Format for set ai_tool active
             if (mode === 'internal' && lowerCommand.startsWith('set ai_tool ')) {
                suggestionToAdd = 'set ai_tool <name> active <0|1>';
             }
            // Add format for persist memory db to
            if (mode === 'internal' && lowerCommand.startsWith('persist memory db to')) {
                 suggestionToAdd = 'persist memory db to <filename.db>';
            }
             // Add format for create sqlite
            if (mode === 'internal' && lowerCommand.startsWith('create sqlite')) {
                 suggestionToAdd = 'create sqlite <filename.db>';
            }
            // Add format for init db
            if (mode === 'internal' && lowerCommand === 'init db') {
                suggestionToAdd = 'init db';
            }
            // Add format for init
            if (mode === 'internal' && lowerCommand === 'init') {
                suggestionToAdd = 'init';
            }
             // Add format for list py vars
            if (mode === 'internal' && lowerCommand === 'list py vars') {
                 suggestionToAdd = 'list py vars';
            }
            // Add format for ai command
            if (mode === 'internal' && lowerCommand.startsWith('ai')) {
                 suggestionToAdd = 'ai <inputtext with {varname}>'; // Updated suggestion text
            }
             // Add format for clipboard get (though it's already in initial)
             if (mode === 'python' && lowerCommand === 'clipboard = get()') {
                  suggestionToAdd = 'clipboard = get()';
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

    // Removed getAllSuggestions as filtering is now handled in page.tsx


    return { suggestions, addSuggestion, initialSuggestions }; // Return categorized suggestions
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
 function getFilename(): string {
     return 'use-suggestions.ts';
 }
