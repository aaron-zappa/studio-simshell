// src/lib/internal-commands/handle-ai-command.ts
// src/lib/internal-commands/handle-ai-command.ts
'use server';
import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types';
import { generateSimpleText, type SimpleTextGenOutput } from '@/ai/flows/simple-text-gen-flow'; // Import the AI flow and its output type
import { storeVariableInDb, getVariableFromDb } from '@/lib/variables'; // Import DB functions
import { getActiveAiToolsMetadata } from '@/lib/ai-tools'; // Import tool metadata fetcher

// Define the structure for the return value
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[];
    toastInfo?: { message: string; variant?: 'default' | 'destructive' }; // Added for toast notifications
}

interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    args: string[]; // ['<inputtext', 'with', '{varname}>', ...]
    timestamp: string;
    currentLogEntries: LogEntry[];
    overridePermissionChecks?: boolean;
}

/**
 * Handles the 'ai &lt;inputtext&gt;' internal command.
 * Substitutes {varname} placeholders with values from the database.
 * Passes the potentially modified input text and user permissions to the simple text generation AI flow.
 * Stores the AI's final response in the 'ai_answer' variable.
 * Can trigger toast notifications based on AI's output.
 */
export const handleAiCommand = async ({ userId, userPermissions, args, timestamp, currentLogEntries, overridePermissionChecks }: HandlerParams): Promise<HandlerResult> => {
    let inputText = args.join(' ').trim(); // Combine all arguments into the input text
    let logText: string;
    let logType: 'I' | 'W' | 'E' = 'I';
    let outputType: OutputLine['type'] = 'info';
    let outputText: string;
    let outputLines: OutputLine[] = [];
    let newLogEntries: LogEntry[] = [...currentLogEntries];
    let logFlag: 0 | 1 = 0; // Default flag
    let toastInfo: HandlerResult['toastInfo'] = undefined;


    if (!inputText) {
        outputText = 'Error: No input text provided for the "ai" command. Usage: ai &lt;inputtext&gt;';
        outputType = 'error';
        logType = 'E';
        logFlag = 1; // Set flag to 1 for error
        logText = outputText;
        outputLines.push({ id: `ai-err-input-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });
        return { outputLines, newLogEntries, toastInfo };
    }

    // --- Variable Substitution ---
    const variableRegex = /\{([a-zA-Z_]\w*)\}/g; // Matches {varname}
    let match;
    let processedInputText = inputText;
    let substitutionError = false;

    // Use a loop to handle multiple variable substitutions
    while ((match = variableRegex.exec(inputText)) !== null) {
        const variableName = match[1];
        try {
             // Check read permission before attempting to fetch
             if (!overridePermissionChecks && !userPermissions.includes('read_variables')) {
                 processedInputText = processedInputText.replace(match[0], `<variable '${variableName}' permission denied>`);
                 const permDeniedMsg = `Permission denied to read variable '${variableName}' for AI command.`;
                 if (!substitutionError) { // Log permission denial only once per command run if multiple vars lack perm
                     newLogEntries.push({ timestamp, type: 'W', flag: 1, text: permDeniedMsg + ` (User: ${userId})` });
                 }
                 substitutionError = true; // Mark that an error occurred
                 continue; // Move to next match
             }


            const variableDetails = await getVariableFromDb(variableName);
            if (variableDetails) {
                processedInputText = processedInputText.replace(match[0], variableDetails.value);
            } else {
                // Variable not found - replace with a placeholder
                processedInputText = processedInputText.replace(match[0], `<variable '${variableName}' not found>`);
                newLogEntries.push({ timestamp, type: 'W', flag: 1, text: `Variable '{${variableName}}' not found during AI command preprocessing. (User: ${userId})` });
                substitutionError = true; // Mark that an error occurred
            }
        } catch (dbError) {
            console.error(`Error retrieving variable '${variableName}' for AI command:`, dbError);
            processedInputText = processedInputText.replace(match[0], `<variable '${variableName}' db_error>`);
            newLogEntries.push({ timestamp, type: 'E', flag: 1, text: `DB error retrieving variable '{${variableName}}' for AI command: ${dbError instanceof Error ? dbError.message : 'Unknown DB error'}. (User: ${userId})` }); // Error flag
            substitutionError = true; // Mark that an error occurred
            // Do not stop processing, just mark the error and continue with other substitutions
        }
    }
    // --- End Variable Substitution ---

    // Add substitution error warning to the main output if needed
     if (substitutionError) {
        outputLines.push({
            id: `ai-subst-warn-${timestamp}`,
            text: "Warning: Some variables could not be substituted. See log for details.",
            type: 'warning',
            category: 'internal',
            timestamp,
            flag: 1
        });
     }


    try {
        // --- AI Flow Call ---
        logText = `AI command processing input: "${processedInputText}" (Original: "${inputText}") for user ${userId}.`;
        newLogEntries.push({ timestamp, type: 'I', flag: 0, text: logText });

        // Call the AI flow with the processed input text and user permissions
        const aiResult: SimpleTextGenOutput = await generateSimpleText({ // Ensure aiResult is typed
            inputText: processedInputText,
            userPermissions: userPermissions
        });
        const aiAnswer = aiResult.answer;

        // Check if AI requested a toast
        if (aiResult.toastMessage) {
            toastInfo = {
                message: aiResult.toastMessage,
                variant: aiResult.toastVariant || 'default'
            };
        }


        // Store the AI answer in the database variable 'ai_answer'
        // Check permission before storing
        if (overridePermissionChecks || userPermissions.includes('manage_variables')) {
            try {
                // Attempt to store in the primary variables table
                await storeVariableInDb('ai_answer', aiAnswer, 'string');
                const successMessage = `AI response stored successfully in variable 'ai_answer'.`;
                outputType = 'info';
                logType = 'I';
                const finalLogText = `AI command executed successfully for user ${userId}. Response stored in 'ai_answer'. Processed input: "${processedInputText}"`;
                newLogEntries.push({ timestamp, type: logType, flag: 0, text: finalLogText });
                outputLines.push({ id: `ai-success-${timestamp}`, text: successMessage, type: outputType, category: 'internal', timestamp, flag: 0 });

                 // Display the AI answer directly as well
                outputLines.push({
                   id: `ai-answer-${timestamp}`,
                   text: `AI Answer: ${aiAnswer}`, // Prefix to clarify it's the answer
                   type: 'output',
                   category: 'internal',
                   timestamp: undefined // Don't format as a log line
                });

                // Check if the error is due to the variables table missing
            } catch (dbError) {
                console.error("Error storing AI answer in DB:", dbError);
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown DB error';

                if (errorMessage.includes("SQL Error: no such table: variables")) {
                    try {
                        // Attempt to store in the fallback variables2 table
                        // Assuming storeVariableInDb supports table name as an optional parameter
                        await storeVariableInDb('ai_answer', aiAnswer, 'string', 'variables2');
                        outputText = `AI response stored successfully in fallback variable table 'variables2' due to missing 'variables' table.`;
                        outputType = 'warning'; // Indicate it's a fallback
                        logType = 'W';
                        logFlag = 1; // Use a flag for warnings
                        logText = outputText + ` (User: ${userId})`;
                        outputLines.push({ id: `ai-success-fallback-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
                        newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });

                    } catch (fallbackDbError) {
                        // If fallback also fails
                        outputText = `AI generated a response, but failed to store it in variable 'ai_answer' or fallback 'variables2': ${fallbackDbError instanceof Error ? fallbackDbError.message : 'Unknown DB error'}`;
                        outputType = 'error';
                        logType = 'E';
                        logFlag = 1; // Error flag
                        logText = outputText;
                        outputLines.push({ id: `ai-err-db-fallback-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
                        newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });
                        outputLines.push({
                            id: `ai-answer-fail-${timestamp}`,
                            text: `AI Answer (generated but not stored): ${aiAnswer}`,
                            type: 'output',
                            category: 'internal',
                            timestamp: undefined
                        });
                    }
                } else {
                    // Handle other database errors for the primary table
                    outputText = `AI generated a response, but failed to store it in variable 'ai_answer': ${errorMessage}`;
                    outputType = 'error';
                    logType = 'E';
                    logFlag = 1; // Error flag
                    logText = outputText;
                    outputLines.push({ id: `ai-err-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
                    newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });
                    outputLines.push({
                        id: `ai-answer-fail-${timestamp}`,
                        text: `AI Answer (generated but not stored): ${aiAnswer}`,
                        type: 'output',
                        category: 'internal',
                        timestamp: undefined
                     });
                }

            }
        } else {
            // User lacks permission to store the variable
             outputText = `AI generated a response, but permission denied to store it in variable 'ai_answer'.`;
            outputType = 'warning'; // Use warning as AI did respond
            logType = 'W';
            logFlag = 1;
            logText = outputText + ` (User ID: ${userId})`;
            outputLines.push({ id: `ai-store-perm-denied-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
            newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });
            // Still display the answer
            outputLines.push({
                id: `ai-answer-nostore-${timestamp}`,
                text: `AI Answer (not stored): ${aiAnswer}`,
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
        logFlag = 1; // Error flag
        logText = outputText;
        outputLines.push({ id: `ai-err-db-${timestamp}`, text: outputText, type: outputType, category: 'internal', timestamp, flag: logFlag });
        newLogEntries.push({ timestamp, type: logType, flag: logFlag, text: logText });
    }

    return {
        outputLines,
        newLogEntries,
        toastInfo // Include toastInfo in the return
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

