import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';

interface HandlerParams {
    args: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
}

// Mode switching is now handled by AI classification before executeCommand is called.
// This handler becomes informational or could be removed.
export const handleMode = ({ args, timestamp, initialSuggestions }: HandlerParams): OutputLine[] => {
    const requestedMode = args[0] as CommandMode;

    if (args.length === 0) {
       return [{ id: `mode-info-${timestamp}`, text: `Command category is automatically detected. Available categories: ${Object.keys(initialSuggestions).join(', ')}. Use 'help' for more info.`, type: 'info', category: 'internal' }];
    }

    // Check if the requested mode is valid just for info purposes
    if (Object.keys(initialSuggestions).includes(requestedMode)) {
        return [{ id: `mode-info-${timestamp}`, text: `Info: You requested mode '${requestedMode}'. Command category is automatically detected.`, type: 'info', category: 'internal' }];
    } else {
        return [{ id: `mode-error-${timestamp}`, text: `Info: '${requestedMode}' is not a recognized category. Categories are automatically detected. Valid categories: ${Object.keys(initialSuggestions).join(', ')}`, type: 'error', category: 'internal' }];
    }
};