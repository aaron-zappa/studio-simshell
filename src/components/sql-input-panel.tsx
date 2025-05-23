// src/components/sql-input-panel.tsx
// src/components/sql-input-panel.tsx
"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Star } from 'lucide-react'; // Using Send icon for the button, add Star for the new button

interface SqlInputPanelProps {
  onSubmit: (sqlQuery: string) => Promise<void>;
  disabled?: boolean;
}

export function SqlInputPanel({ onSubmit, disabled = false }: SqlInputPanelProps) {
  const [sqlQuery, setSqlQuery] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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

  const handleInsertText = (textToInsert: string) => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      const newValue = 
        value.substring(0, selectionStart) + 
        textToInsert + 
        value.substring(selectionEnd);
      
      setSqlQuery(newValue);
      
      // Move cursor to after the inserted text
      const newCursorPosition = selectionStart + textToInsert.length;
      // Use a timeout to ensure the state update has rendered
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    }
  };

  return (
    <div className="flex flex-col space-y-2 rounded-md border p-4 shadow-sm bg-card">
      <Textarea
        ref={textareaRef}
        placeholder="Enter SQL query here. Press Ctrl+Enter or Cmd+Enter to execute."
        value={sqlQuery}
        onChange={(e) => setSqlQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="font-mono text-sm h-32 resize-y" // Allow vertical resize
        disabled={disabled}
        aria-label="SQL Query Input"
      />
      <div className="flex justify-between items-center">
        <Button 
          onClick={() => handleInsertText("SELECT * FROM ")} 
          disabled={disabled}
          variant="outline"
          size="sm"
          className="flex items-center"
        >
          <Star className="mr-2 h-3 w-3" /> SELECT * FROM
        </Button>
        <Button onClick={handleSubmit} disabled={disabled || !sqlQuery.trim()} className="self-end">
          <Send className="mr-2 h-4 w-4" /> Execute SQL
        </Button>
      </div>
    </div>
  );
}
