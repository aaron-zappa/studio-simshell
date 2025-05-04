
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';

interface HandlerParams {
    args: string[];
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
}

export const handleMode = ({ args, timestamp, initialSuggestions }: HandlerParams): OutputLine[] => {
    const newMode = args[0] as CommandMode;
    // Check against the static list of supported modes
    if (Object.keys(initialSuggestions).includes(newMode)) {
        // Mode change application is handled client-side after confirmation
        return [{ id: `out-${timestamp}`, text: `Switched to ${newMode} mode.`, type: 'info', category: 'internal' }];
    } else {
        return [{ id: `out-${timestamp}`, text: `Error: Invalid mode '${args[0]}'. Available modes: ${Object.keys(initialSuggestions).join(', ')}`, type: 'error', category: 'internal' }];
    }
};
