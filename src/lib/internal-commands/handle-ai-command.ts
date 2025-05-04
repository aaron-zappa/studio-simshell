// src/lib/internal-commands/handle-ai-command.ts
// src/lib/internal-commands/handle-ai-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { generateSimpleText } from '@/ai/flows/simple-text-gen-flow'; // Import the AI flow
import { storeVariableInDb, getVariableFromDb } from '@/lib/variables'; // Import DB functions

// Define the structure for the return value
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
}

interface HandlerParams {
    args: string[]; // ['<inputtext>', ...]
    timestamp: string;
    currentLogEntries: LogEntry[];
}

/**
 * Handles the 'ai <inputtext>' internal command.
 * Parses input text for {varname} references, substitutes their values from the DB.
 * Calls the simple text generation AI flow and stores the result in 'ai_answer' variable.
 */
export const handleAiCommand = async ({ args, timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const rawInputText = args.join(' ').trim(); // Combine all arguments into the input text
    let logText: string;
    let logType: 'I' | 'W' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let outputLines: OutputLine[] = [];
    let newLogEntries: LogEntry[] = [...currentLogEntries];
    let processedInputText = rawInputText;

    if (!rawInputText) {
        outputText = 'Error: No input text provided for the "ai" command. Usage: ai <inputtext>';
        outputType = 'error';
        logType = 'E';
        logText = outputText;
        outputLines.push({ id: `ai-err-input-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        newLogEntries.push({ timestamp, type: logType, text: logText });
        return { outputLines, newLogEntries };
    }

    try {
        // --- Variable Substitution ---
        const varRegex = /{([a-zA-Z_]\w*)}/g;
        const varMatches = [...rawInputText.matchAll(varRegex)];
        const varNamesToFetch = [...new Set(varMatches.map(match => match[1]))]; // Unique variable names

        if (varNamesToFetch.length > 0) {
            const fetchPromises = varNamesToFetch.map(name => getVariableFromDb(name));
            const fetchedVars = await Promise.all(fetchPromises);
            const varValuesMap = new Map<string, string | null>();

            varNamesToFetch.forEach((name, index) => {
                const variable = fetchedVars[index];
                varValuesMap.set(name, variable ? variable.value : null); // Store value or null if not found
            });

            // Replace placeholders in the input text
            processedInputText = rawInputText.replace(varRegex, (match, varName) => {
                const value = varValuesMap.get(varName);
                if (value !== null && value !== undefined) {
                    return value; // Substitute with the found value
                } else {
                    logType = 'W'; // Downgrade log type to warning if var not found
                    newLogEntries.push({
                        timestamp,
                        type: 'W',
                        text: `Variable '{${varName}}' not found during AI command processing.`
                    });
                    return `<variable '${varName}' not found>`; // Substitute with an error message
                }
            });
             logText = `AI command processing input: "${rawInputText}". Variables substituted. Processed input: "${processedInputText}"`;
             if(logType === 'I') newLogEntries.push({ timestamp, type: 'I', text: logText }); // Log successful substitution attempt
        } else {
             logText = `AI command processing input: "${rawInputText}". No variables to substitute.`;
             newLogEntries.push({ timestamp, type: 'I', text: logText }); // Log processing without substitution
        }
        // --- End Variable Substitution ---


        // Call the AI flow with processed text
        const aiResult = await generateSimpleText({ inputText: processedInputText });
        const aiAnswer = aiResult.answer;

        // Store the AI answer in the database variable 'ai_answer'
        try {
            await storeVariableInDb('ai_answer', aiAnswer, 'string');
            outputText = `AI response stored successfully in variable 'ai_answer'.`;
            outputType = 'info';
            // Update log text to include indication of variable substitution if it happened
            const finalLogText = `AI command executed successfully. Response stored in 'ai_answer'. Original input: "${rawInputText}". Processed input: "${processedInputText}"`;
            newLogEntries.push({ timestamp, type: logType, text: finalLogText }); // Use potentially downgraded logType
            outputLines.push({ id: `ai-success-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });

             // Optionally, display the AI answer directly as well
             outputLines.push({
                id: `ai-answer-${timestamp}`,
                text: `AI Answer: ${aiAnswer}`, // Prefix to clarify it's the answer
                type: 'output', // Display as regular output
                category: 'internal', // Keep category as internal since it's the result of an internal command
                timestamp: undefined // Don't format as a log line
             });


        } catch (dbError) {
            console.error("Error storing AI answer in DB:", dbError);
            outputText = `AI generated a response, but failed to store it in variable 'ai_answer': ${dbError instanceof Error ? dbError.message : 'Unknown DB error'}`;
            outputType = 'error';
            logType = 'E';
            logText = outputText;
            // Add error about DB storage
             outputLines.push({ id: `ai-err-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            // Log the DB error
            newLogEntries.push({ timestamp, type: logType, text: logText });
            // Still add the AI answer itself to output if it was generated
            outputLines.push({
                id: `ai-answer-fail-${timestamp}`,
                text: `AI Answer (generated but not stored): ${aiAnswer}`,
                type: 'output',
                category: 'internal',
                timestamp: undefined
             });
        }

    } catch (aiError) {
        console.error("Error during AI command processing (including var substitution or AI call):", aiError);
        outputText = `Error processing AI command: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
        outputType = 'error';
        logType = 'E';
        logText = outputText;
        outputLines.push({ id: `ai-err-gen-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        newLogEntries.push({ timestamp, type: logType, text: logText });
    }

    return {
        outputLines,
        newLogEntries
    };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-ai-command.ts';
}
