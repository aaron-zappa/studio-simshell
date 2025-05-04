
import type { OutputLine } from '@/components/output-display';
import type { CommandMode } from '@/types/command-types';

interface HandlerParams {
    timestamp: string;
    initialSuggestions: Record<string, string[]>;
}

export const handleHelp = ({ timestamp, initialSuggestions }: HandlerParams): OutputLine[] => {
    const helpText = `Available modes: ${Object.keys(initialSuggestions).join(', ')}.
Use 'mode [mode_name]' to switch.
Available internal commands: help, clear, mode, history, define, refine, add_int_cmd <short> <name> "<description>" <whatToDo>, export log, pause, create sqlite <filename.db>
Run custom commands by typing their name.`;
    return [{ id: `out-${timestamp}`, text: helpText, type: 'output', category: 'internal' }];
};
