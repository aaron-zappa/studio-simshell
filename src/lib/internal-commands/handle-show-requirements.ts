// src/lib/internal-commands/handle-show-requirements.ts
// src/lib/internal-commands/handle-show-requirements.ts
'use server';

import type { OutputLine } from '@/components/output-display';
import type { LogEntry } from '@/types/log-types'; // Import new LogEntry
import * as path from 'path';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Uses new LogEntry type
}


interface HandlerParams {
    userId: number; // Added userId
    userPermissions: string[]; // Added permissions
    args: string[];
    timestamp: string;
    currentLogEntries: LogEntry[]; // Pass current logs
}

/**
 * Handles the 'show requirements' command.
 * Displays the NEW log entry structure (timestamp, type, text) as CSV.
 */
// Update function signature to return HandlerResult
export const handleShowRequirements = async ({ timestamp, args, currentLogEntries, userId }: HandlerParams): Promise<HandlerResult> => {
    // No specific permission check needed for this informational command
    let outputText = '';
    let outputType: OutputLine['type'] = 'output';
    let logText: string = '';
    let logType: 'I' | 'E' = 'I';
    const definitionFilename = 'src/types/log-types.ts'; // File defining the LogEntry type

    try {
        // Define the new requirements based on LogEntry { timestamp, type, text }
        const requirements = [
            { requi_code: 'timestamp', requirement: 'ISO string timestamp of the log event.' },
            { requi_code: 'type', requirement: 'Type of log event: I (Info), W (Warning), E (Error).' },
            { requi_code: 'text', requirement: 'The descriptive text of the log event.' },
        ];

        // Define CSV header
        const header = 'filename,requi_code,requirement';
        // Create CSV rows
        const rows = requirements.map(req => {
             // Prepend filename basename to requi_code
             const baseFilename = path.basename(definitionFilename);
             const formattedRequiCode = `${baseFilename}:${req.requi_code}`;

            // Basic CSV formatting
            const filenameCsv = definitionFilename.includes(',') ? `"${definitionFilename}"` : definitionFilename;
            const requiCodeCsv = formattedRequiCode.includes(',') ? `"${formattedRequiCode}"` : formattedRequiCode;
            const requirementCsv = req.requirement.includes(',') || req.requirement.includes('"')
                ? `"${req.requirement.replace(/"/g, '""')}"`
                : req.requirement;
            return `${filenameCsv},${requiCodeCsv},${requirementCsv}`;
        }).join('\n');

        outputText = header + '\n' + rows + `\n(${requirements.length} requirement${requirements.length === 1 ? '' : 's'} found)`;
        logText = `Displayed log requirements. Found ${requirements.length}. (User: ${userId})`;

    } catch (error) {
        console.error("Error generating requirements CSV:", error);
        outputText = `Error generating requirements list: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
        logText = outputText + ` (User: ${userId})`;
        logType = 'E';
    }

    // TODO: Handle arguments if needed
    if (args.length > 0) {
        console.warn("'show requirements' currently ignores arguments:", args);
        // Optionally add to logText if needed
    }

     const outputLines: OutputLine[] = [{
        id: `req-${outputType}-${timestamp}`,
        text: outputText,
        type: outputType,
        category: 'internal',
        timestamp: outputType === 'error' || outputType === 'info' ? timestamp : undefined // Add timestamp for errors/info
    }];

    // Create log entry
    const logEntry: LogEntry = { timestamp, type: logType, text: logText };
    const newLogEntries = [...currentLogEntries, logEntry];

    // Return the result object
    return { outputLines: outputLines, newLogEntries };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-show-requirements.ts';
}
