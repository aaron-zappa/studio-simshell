// src/lib/internal-commands/handle-ai-command.ts
// src/lib/internal-commands/handle-ai-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { generateSimpleText } from '@/ai/flows/simple-text-gen-flow'; // Import the AI flow
import { storeVariableInDb } from '@/lib/variables'; // Import DB storage function

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
 * Calls the simple text generation AI flow and stores the result in 'ai_answer' variable.
 */
export const handleAiCommand = async ({ args, timestamp, currentLogEntries }: HandlerParams): Promise<HandlerResult> => {
    const inputText = args.join(' ').trim(); // Combine all arguments into the input text
    let logText: string;
    let logType: 'I' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let outputLines: OutputLine[] = [];
    let newLogEntries: LogEntry[] = [...currentLogEntries];

    if (!inputText) {
        outputText = 'Error: No input text provided for the "ai" command. Usage: ai <inputtext>';
        outputType = 'error';
        logType = 'E';
        logText = outputText;
        outputLines.push({ id: `ai-err-input-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
        newLogEntries.push({ timestamp, type: logType, text: logText });
        return { outputLines, newLogEntries };
    }

    try {
        // Call the AI flow
        const aiResult = await generateSimpleText({ inputText });
        const aiAnswer = aiResult.answer;

        // Store the AI answer in the database variable 'ai_answer'
        try {
            await storeVariableInDb('ai_answer', aiAnswer, 'string');
            outputText = `AI response stored successfully in variable 'ai_answer'.`;
            outputType = 'info';
            logText = `AI command executed with input "${inputText}". Response stored in 'ai_answer'.`;
            logType = 'I';
            outputLines.push({ id: `ai-success-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp });
            newLogEntries.push({ timestamp, type: logType, text: logText });

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
        console.error("Error calling AI flow:", aiError);
        outputText = `Error generating AI response: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
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
