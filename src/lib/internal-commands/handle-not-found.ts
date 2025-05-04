
import type { OutputLine } from '@/components/output-display';

interface HandlerParams {
    commandName: string;
    timestamp: string;
}

export const handleNotFound = ({ commandName, timestamp }: HandlerParams): OutputLine[] => {
    return [{ id: `out-${timestamp}`, text: `Internal command not found: ${commandName}`, type: 'error', category: 'internal' }];
};
