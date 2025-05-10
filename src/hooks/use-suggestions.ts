// src/hooks/use-suggestions.ts
// src/hooks/use-suggestions.ts
import * as React from 'react';
import type { CommandMode } from '@/types/command-types';
import type { CustomCommands } from './use-custom-commands';
import { internalCommandDefinitions } from '@/lib/internal-commands-definitions'; // Import new definitions

// Generate initial internal suggestions from definitions
const initialInternalSuggestions = internalCommandDefinitions.map(cmd => {
    let suggestion = cmd.name;
    if (cmd.argsFormat) {
        suggestion += ` ${cmd.argsFormat}`;
    } else if (cmd.exampleUsage && cmd.exampleUsage.startsWith(cmd.name)) {
        // Fallback to example usage if argsFormat is missing but exampleUsage provides argument structure
        suggestion = cmd.exampleUsage;
    }
    return suggestion;
});


// Initial suggestions, will be mutable
const initialSuggestionsData: Record<CommandMode, string[]> = {
  internal: initialInternalSuggestions,
  python: [
      'print("text")', 'variable = value', 'def function_name():', 'import module_name', 'class ClassName:', 'if condition:', 'else:', 'elif condition:', 'for item in iterable:', 'while condition:', 'try:', 'except Exception as e:', 'return value', 'yield value',
      'clipboard = get()'
    ],
  unix: ['ls', 'cd <directory>', 'pwd', 'mkdir <directory_name>', 'rm <file_or_directory>', 'cp <source> <destination>', 'mv <source> <destination>', 'cat <file>', 'grep "<pattern>" <file>', 'echo "<text>"', 'man <command>', 'sudo <command>'],
  windows: ['dir [drive:][path][filename]', 'cd [drive:][path]', 'cls', 'mkdir [drive:]path', 'rmdir [drive:]path', 'copy <source> <destination>', 'move <source> <destination>', 'type [drive:][path]filename', 'findstr /C:"string" <filename>', 'echo [message]', 'help [command]'],
  sql: ['SELECT * FROM <table_name>;', 'INSERT INTO <table_name> (column1, column2) VALUES (value1, value2);', 'UPDATE <table_name> SET column1 = value1 WHERE condition;', 'DELETE FROM <table_name> WHERE condition;', 'CREATE TABLE <table_name> (column1 datatype, column2 datatype);', 'ALTER TABLE <table_name> ADD column_name datatype;', 'DROP TABLE <table_name>;', 'SELECT 1;', 'SELECT * FROM INFORMATION_SCHEMA.TABLES;', "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'your_table_name';"],
  excel: ['SUM(A1:B5)', 'AVERAGE(C1:C10)', 'COUNT(D1:D100)', 'MAX(E1:E50)', 'MIN(F1:F20)', 'IF(logical_test, value_if_true, value_if_false)', 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])', 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])', 'INDEX(array, row_num, [column_num])', 'MATCH(lookup_value, lookup_array, [match_type])'],
  typescript: [
    'console.log("message");', 'let variableName: type = value;', 'const constantName: type = value;', 'type CustomType = { property: type };', 'interface MyInterface { method(): void; }', 'function functionName(param: type): returnType { /* ... */ }', 'import { member } from "module";', 'export const exportedValue = 123;'
  ],
};


export const useSuggestions = () => {
    const [suggestions, setSuggestions] = React.useState(initialSuggestionsData);
    // Make initialSuggestionsData available directly for help command if needed,
    // but primary source for internal commands in help should be internalCommandDefinitions.
    const getInitialSuggestions = React.useCallback(() => initialSuggestionsData, []);


    // Add suggestion still needs a mode context
     const addSuggestion = React.useCallback((mode: CommandMode, command: string) => {
        setSuggestions(prev => {
            const modeSuggestions = prev[mode] || [];
            const lowerCommand = command.toLowerCase();
            let suggestionToAdd = command; // Use original casing for suggestion text

            // For internal commands, try to find its definition to format the suggestion
            if (mode === 'internal') {
                const cmdDef = internalCommandDefinitions.find(def => def.name === lowerCommand);
                if (cmdDef) {
                    suggestionToAdd = cmdDef.name;
                     if (cmdDef.argsFormat) {
                        suggestionToAdd += ` ${cmdDef.argsFormat}`;
                    } else if (cmdDef.exampleUsage && cmdDef.exampleUsage.startsWith(cmdDef.name)) {
                        suggestionToAdd = cmdDef.exampleUsage;
                    }
                }
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


    return { suggestions, addSuggestion, initialSuggestions: getInitialSuggestions() };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
     return 'use-suggestions.ts';
 }
