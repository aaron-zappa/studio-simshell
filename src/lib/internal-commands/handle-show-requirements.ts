// src/lib/internal-commands/handle-show-requirements.ts
'use server';

import type { OutputLine } from '@/components/output-display';
import { getRequiArr } from '@/lib/logging'; // Import the function to get the requirements array
import * as path from 'path';

interface HandlerParams {
    args: string[];
    timestamp: string;
}

/**
 * Handles the 'show requirements' command.
 * Displays the structure required for log entries (from getRequiArr) in CSV format.
 * The requi_code is prefixed with the filename where the structure is defined.
 * Ignores any arguments provided.
 */
export const handleShowRequirements = async ({ timestamp, args }: HandlerParams): Promise<OutputLine[]> => {
    let outputText = '';
    const definitionFilename = 'src/lib/logging.ts'; // Filename where LogEntry/RequiElement are defined

    try {
        const requirements = getRequiArr();

        if (requirements.length === 0) {
            outputText = 'No requirements defined.';
        } else {
             // Define CSV header
            const header = 'filename,requi_code,requirement';
             // Create CSV rows
            const rows = requirements.map(req => {
                // Prepend filename to requi_code
                const formattedRequiCode = `${path.basename(definitionFilename)}:${req.requi_code}`;
                // Basic CSV formatting, quoting fields if they contain commas
                const filenameCsv = definitionFilename.includes(',') ? `"${definitionFilename}"` : definitionFilename;
                const requiCodeCsv = formattedRequiCode.includes(',') ? `"${formattedRequiCode}"` : formattedRequiCode;
                const requirementCsv = req.requirement.includes(',') ? `"${req.requirement.replace(/"/g, '""')}"` : req.requirement; // Also escape quotes within requirement
                return `${filenameCsv},${requiCodeCsv},${requirementCsv}`;
            }).join('\n');
            outputText = header + '\n' + rows + `\n(${requirements.length} requirements found)`;
        }

    } catch (error) {
        console.error("Error generating requirements CSV:", error);
        outputText = `Error generating requirements list: ${error instanceof Error ? error.message : 'Unknown error'}`;
         return [{
            id: `req-error-${timestamp}`,
            text: outputText,
            type: 'error',
            category: 'internal'
        }];
    }

    // TODO: Handle arguments if needed (e.g., filtering)
    if (args.length > 0) {
        console.warn("'show requirements' currently ignores arguments:", args);
    }

    return [{
        id: `req-output-${timestamp}`,
        text: outputText,
        type: 'output',
        category: 'internal'
    }];
};
