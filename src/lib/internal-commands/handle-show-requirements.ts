// src/lib/internal-commands/handle-show-requirements.ts
// src/lib/internal-commands/handle-show-requirements.ts
'use server';

import type { OutputLine } from '@/components/output-display';
import { getRequiArr, type LogEntry, type RequiElement } from '@/lib/logging'; // Import necessary types/functions
import * as path from 'path';

// Define the structure for the return value, including potential log updates
interface HandlerResult {
    outputLines: OutputLine[];
    newLogEntries?: LogEntry[]; // Optional: Only if logs were modified (not applicable here)
}


interface HandlerParams {
    args: string[];
    timestamp: string;
    // Potentially add currentLogEntries if needed
}

/**
 * Handles the 'show requirements' command.
 * Displays the structure required for log entries (from getRequiArr) in CSV format.
 * The requi_code is prefixed with the filename where the structure is defined.
 * Ignores any arguments provided.
 */
// Update function signature to return HandlerResult
export const handleShowRequirements = async ({ timestamp, args }: HandlerParams): Promise<HandlerResult> => {
    let outputText = '';
    let outputType: OutputLine['type'] = 'output';
    const definitionFilename = 'src/lib/logging.ts'; // Filename where LogEntry/RequiElement are defined

    try {
        const requirements: RequiElement[] = getRequiArr();

        if (requirements.length === 0) {
            outputText = 'No requirements defined.';
        } else {
             // Define CSV header
            const header = 'filename,requi_code,requirement';
             // Create CSV rows
            const rows = requirements.map(req => {
                 // Prepend filename basename to requi_code
                 const baseFilename = path.basename(definitionFilename);
                 const formattedRequiCode = `${baseFilename}:${req.requi_code}`;

                // Basic CSV formatting, quoting fields if they contain commas or quotes
                const filenameCsv = definitionFilename.includes(',') ? `"${definitionFilename}"` : definitionFilename;
                const requiCodeCsv = formattedRequiCode.includes(',') ? `"${formattedRequiCode}"` : formattedRequiCode;
                const requirementCsv = req.requirement.includes(',') || req.requirement.includes('"')
                    ? `"${req.requirement.replace(/"/g, '""')}"`
                    : req.requirement;
                return `${filenameCsv},${requiCodeCsv},${requirementCsv}`;
            }).join('\n');
            outputText = header + '\n' + rows + `\n(${requirements.length} requirement${requirements.length === 1 ? '' : 's'} found)`;
        }

    } catch (error) {
        console.error("Error generating requirements CSV:", error);
        outputText = `Error generating requirements list: ${error instanceof Error ? error.message : 'Unknown error'}`;
        outputType = 'error';
    }

    // TODO: Handle arguments if needed (e.g., filtering)
    if (args.length > 0) {
        console.warn("'show requirements' currently ignores arguments:", args);
    }

     const outputLines: OutputLine[] = [{
        id: `req-${outputType}-${timestamp}`,
        text: outputText,
        type: outputType,
        category: 'internal'
    }];

    // Return the result object (no log changes)
    return { outputLines: outputLines };
};

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'handle-show-requirements.ts';
}
