// src/lib/internal-commands/handle-pause.ts
import type { OutputLine } from '@/components/output-display';

interface HandlerParams {
    timestamp: string;
}

export const handlePause = ({ timestamp }: HandlerParams): OutputLine[] => {
    // 'pause' logic is primarily client-side to interact with the running state.
    // This server-side handler might provide confirmation if needed, but the core stop logic is client-side.
    return [{ id: `out-${timestamp}`, text: `'pause' command acknowledged server-side (actual stop is client-side).`, type: 'info', category: 'internal' }];
};
