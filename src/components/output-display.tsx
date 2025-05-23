// src/components/output-display.tsx
// src/components/output-display.tsx
"use client";

import * as React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CommandMode } from '@/types/command-types'; // Import shared type
import type { LogEntry } from '@/types/log-types'; // Import LogEntry type

export type OutputLine = {
  id: string; // For React key prop
  text: string;
  type?: 'command' | 'output' | 'error' | 'info' | 'warning';
  category?: CommandMode | 'internal';
  timestamp?: string;
  flag?: 0 | 1;
  issuer?: { // New field for command issuer details
    username: string; // Changed from name to username
    role: string;
  };
};

interface OutputDisplayProps {
  history: OutputLine[];
  className?: string;
}

// Helper to determine category styling
const getCategoryStyle = (category?: OutputLine['category']): string => {
  switch (category) {
    case 'python': return 'text-accent-green';
    case 'unix': return 'text-accent-yellow';
    case 'windows': return 'text-blue-500';
    case 'sql': return 'text-purple-500';
    case 'excel': return 'text-green-700 dark:text-green-400';
    case 'typescript': return 'text-sky-500';
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
                const showLogFormat = (line.type === 'info' || line.type === 'error' || line.type === 'warning') && line.timestamp && typeIndicator && line.flag !== undefined;

                let commandDisplayPrefix = "";
                if (line.type === 'command' && !showLogFormat) { // Only apply custom prefix if not in log format
                    if (line.issuer && line.issuer.username && line.issuer.role) { // Changed to line.issuer.username
                        commandDisplayPrefix = `partner in role ${line.issuer.role}: ${line.issuer.username}$ `;
                    } else {
                        commandDisplayPrefix = "$ "; // Fallback prefix for commands
                    }
                }

                return (
                  <div key={line.id} className="flex items-start space-x-2">
                     <span className={cn(
                       "whitespace-pre-wrap break-words",
                       line.type === 'command' && 'text-foreground font-semibold',
                       line.type === 'error' && 'text-destructive',
                       (line.type === 'info' || line.type === 'warning') && !showLogFormat && 'text-muted-foreground italic', // Avoid italic if it's a log-formatted line
                       (line.type === 'info' || line.type === 'warning') && showLogFormat && 'text-muted-foreground', // For log-formatted, don't italicize
                       getCategoryStyle(line.category)
                     )}>
                        {showLogFormat
                           ? `${line.timestamp},${typeIndicator},${line.flag},${line.text}`
                           : `${commandDisplayPrefix}${line.text}`
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
