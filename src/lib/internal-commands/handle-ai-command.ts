// src/lib/internal-commands/handle-ai-command.ts
// src/lib/internal-commands/handle-ai-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { generateSimpleText } from '@/ai/flows/simple-text-gen-flow'; // Import the AI flow
import { storeVariableInDb } from '@/lib/variables'; // Import DB functions for storing the answer

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
 * Passes the raw input text to the simple text generation AI flow.
 * The AI flow is now responsible for using tools (like getVariableValue) if needed.
 * Stores the AI's final response in the 'ai_answer' variable.
 */
export const handleAiCommand = async ({ args, timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const rawInputText = args.join(' ').trim(); // Combine all arguments into the input text
    let logText: string;
    let logType: 'I' | 'W' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let outputLines: OutputLine[] = [];
    let newLogEntries: LogEntry[] = [...currentLogEntries];

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
        // --- AI Flow Call ---
        logText = `AI command processing raw input: "${rawInputText}".`;
        newLogEntries.push({ timestamp, type: 'I', text: logText });

        // Call the AI flow with the raw input text
        const aiResult = await generateSimpleText({ inputText: rawInputText });
        const aiAnswer = aiResult.answer;

        // Store the AI answer in the database variable 'ai_answer'
        try {
            await storeVariableInDb('ai_answer', aiAnswer, 'string');
            outputText = `AI response stored successfully in variable 'ai_answer'.`;
            outputType = 'info';
            logType = 'I';
            const finalLogText = `AI command executed successfully. Response stored in 'ai_answer'. Raw input: "${rawInputText}"`;
            newLogEntries.push({ timestamp, type: logType, text: finalLogText });
            outputLines.push({ id: `ai-success-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });

             // Display the AI answer directly as well
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
            outputLines.push({ id: `ai-err-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            newLogEntries.push({ timestamp, type: logType, text: logText });
            outputLines.push({
                id: `ai-answer-fail-${timestamp}`,
                text: `AI Answer (generated but not stored): ${aiAnswer}`,
                type: 'output',
                category: 'internal',
                timestamp: undefined
             });
        }

    } catch (aiError) {
        console.error("Error during AI command processing (AI call):", aiError);
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
