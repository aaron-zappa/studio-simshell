
import type { OutputLine } from '@/components/output-display';

interface HandlerParams {
    args: string[];
    timestamp: string;
}

// Sample requirement data (replace with actual data source if needed)
const sampleRequirements = [
    { filename: "system.spec", code: "REQ-001", requirement: "The system shall authenticate users." },
    { filename: "system.spec", code: "REQ-002", requirement: "The system shall store logs securely." },
    { filename: "ui.spec", code: "REQ-UI-01", requirement: "The UI must be responsive." },
];

/**
 * Handles the 'show requirements' command.
 * Displays sample requirements in CSV format.
 * Currently ignores any arguments provided.
 */
export const handleShowRequirements = ({ timestamp, args }: HandlerParams): OutputLine[] => {
    // Define CSV header
    const header = 'filename,requi_code,requirement';

    // Convert sample requirements to CSV rows, quoting fields appropriately
    const rows = sampleRequirements.map(req =>
        [
            `"${req.filename.replace(/"/g, '""')}"`,
            `"${req.code.replace(/"/g, '""')}"`,
            `"${req.requirement.replace(/"/g, '""')}"`
        ].join(',')
    ).join('\n');

    const csvOutput = header + '\n' + rows;

    // TODO: Handle arguments if needed (e.g., filtering requirements)
    if (args.length > 0) {
        console.warn("'show requirements' currently ignores arguments:", args);
    }

    return [{
        id: `req-output-${timestamp}`,
        text: csvOutput,
        type: 'output',
        category: 'internal'
    }];
};
