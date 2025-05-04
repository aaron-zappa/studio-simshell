// src/components/output-display.tsx
// src/components/output-display.tsx
"use client";

import * as React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CommandMode } from '@/types/command-types'; // Import shared type

export type OutputLine = {
  id: string; // For React key prop
  text: string;
  type?: 'command' | 'output' | 'error' | 'info' | 'warning'; // Added 'warning' type potentially
  category?: CommandMode | 'internal'; // Use imported CommandMode
  timestamp?: string; // Added optional timestamp for log-like formatting
};

interface OutputDisplayProps {
  history: OutputLine[];
  className?: string;
}

// Helper to determine category styling
const getCategoryStyle = (category?: OutputLine['category']): string => {
  switch (category) {
    case 'python': return 'text-accent-green'; // Example: Green for Python
    case 'unix': return 'text-accent-yellow'; // Example: Yellow for Unix
    case 'windows': return 'text-blue-500'; // Example: Blue for Windows (using Tailwind directly for simplicity)
    case 'sql': return 'text-purple-500'; // Example: Purple for SQL
    case 'excel': return 'text-green-700 dark:text-green-400'; // Example: Dark Green for Excel
    default: return '';
  }
};

// Helper to get single letter type indicator
const getTypeIndicator = (type?: OutputLine['type']): string | null => {
    switch(type) {
        case 'info': return 'I';
        case 'warning': return 'W';
        case 'error': return 'E';
        default: return null;
    }
}

export function OutputDisplay({ history, className }: OutputDisplayProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom when history updates
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [history]);


  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardContent className="flex-1 p-4 overflow-hidden">
         <ScrollArea className="h-full w-full pr-4" ref={scrollAreaRef}>
          <div className="space-y-2 font-mono text-sm">
            {history.map((line) => {
                const typeIndicator = getTypeIndicator(line.type);
                const showLogFormat = (line.type === 'info' || line.type === 'error' || line.type === 'warning') && line.timestamp && typeIndicator;

                return (
                  <div key={line.id} className="flex items-start space-x-2">
                     <span className={cn(
                       "whitespace-pre-wrap break-words",
                       line.type === 'command' && 'text-foreground font-semibold',
                       line.type === 'error' && 'text-destructive',
                       (line.type === 'info' || line.type === 'warning') && 'text-muted-foreground italic',
                       // Apply category style even for log-formatted lines if category exists
                       getCategoryStyle(line.category)
                     )}>
                        {line.type === 'command' && '$ '}
                        {showLogFormat
                           ? `${line.timestamp},${typeIndicator},${line.text}`
                           : line.text
                        }
                      </span>
                  </div>
                );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
export function getFilename(): string {
    return 'output-display.tsx';
}
