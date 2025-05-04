
import type { OutputLine } from '@/components/output-display';
import type { CustomCommandAction } from '@/hooks/use-custom-commands';

interface HandlerParams {
    timestamp: string;
}

export const handleCustomCommand = async (params: HandlerParams, action: CustomCommandAction): Promise<OutputLine[]> => {
    const { timestamp } = params;
    // Simulate potential delay for custom commands
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate 0.5 second delay
    // Execute the custom command's action (currently just echo)
    return [{ id: `out-${timestamp}`, text: action, type: 'output', category: 'internal' }];
};
