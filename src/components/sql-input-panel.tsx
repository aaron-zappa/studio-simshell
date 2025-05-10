// src/components/sql-input-panel.tsx
// src/components/sql-input-panel.tsx
"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from 'lucide-react'; // Using Send icon for the button

interface SqlInputPanelProps {
  onSubmit: (sqlQuery: string) => Promise<void>;
  disabled?: boolean;
}

export function SqlInputPanel({ onSubmit, disabled = false }: SqlInputPanelProps) {
  const [sqlQuery, setSqlQuery] = React.useState("");

  const handleSubmit = async () => {
    if (disabled || !sqlQuery.trim()) return;
    await onSubmit(sqlQuery.trim());
    setSqlQuery(""); // Clear input after submit
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { // Ctrl+Enter or Cmd+Enter to submit
        event.preventDefault();
        handleSubmit();
    }
  };

  return (
    <div className="flex flex-col space-y-2 rounded-md border p-4 shadow-sm bg-card">
      <Textarea
        placeholder="Enter SQL query here. Press Ctrl+Enter or Cmd+Enter to execute."
        value={sqlQuery}
        onChange={(e) => setSqlQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="font-mono text-sm h-32 resize-y" // Allow vertical resize
        disabled={disabled}
        aria-label="SQL Query Input"
      />
      <Button onClick={handleSubmit} disabled={disabled || !sqlQuery.trim()} className="self-end">
        <Send className="mr-2 h-4 w-4" /> Execute SQL
      </Button>
    </div>
  );
}

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'sql-input-panel.tsx';
}
