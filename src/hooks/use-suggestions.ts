// src/hooks/use-suggestions.ts
// src/hooks/use-suggestions.ts
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


    // Add suggestion still needs a mode context
     const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            const lowerCommand = command.toLowerCase();
            let suggestionToAdd = lowerCommand;

            // Special format for add_int_cmd suggestion itself - adjust if needed
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

    // Removed getAllSuggestions as filtering is now handled in page.tsx


    // This function was incorrectly placed and exported from within the hook.
    // Removed as it causes a parsing error and is not usable outside the hook.
    // function getFilename(): string {
    //     return 'use-suggestions.ts';
    // }


    return { suggestions, addSuggestion, initialSuggestions }; // Return categorized suggestions
};

// Add getFilename at the module level if needed, but ensure it's not within the hook.
// However, for hooks, this pattern might not be standard. Let's omit it for now.
// function getFilename(): string {
//     return 'use-suggestions.ts';
// }
