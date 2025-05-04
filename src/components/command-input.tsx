// src/components/command-input.tsx
// src/components/command-input.tsx
"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea instead of Input
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command as CommandPrimitive, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command"; // Use ShadCN Command
import { cn } from "@/lib/utils";
import { Terminal } from 'lucide-react';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  suggestions: string[]; // List of possible commands/subcommands from *active* modes
  className?: string;
  disabled?: boolean;
}

export function CommandInput({ onSubmit, suggestions, className, disabled = false }: CommandInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null); // Change ref type to HTMLTextAreaElement

  // Change event type to HTMLTextAreaElement
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInputValue(value);

    if (value.trim().length > 0 && !disabled) {
      const lowerCaseValue = value.toLowerCase();
      // Filter suggestions based on input, ignoring case
      const filtered = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().startsWith(lowerCaseValue) && suggestion.toLowerCase() !== lowerCaseValue
      );
      setFilteredSuggestions(filtered);
      setIsPopoverOpen(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setIsPopoverOpen(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (disabled) return;

    setInputValue(suggestion + " ");
    setIsPopoverOpen(false);
    setFilteredSuggestions([]);
    inputRef.current?.focus();
  };

   // Change event type to HTMLTextAreaElement
   const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;

    // Submit on Enter unless Shift is held (for potential future multi-line input)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent default newline insertion
        handleSubmit();
    } else if (event.key === 'Tab' && filteredSuggestions.length > 0) {
        event.preventDefault();
        handleSuggestionClick(filteredSuggestions[0]);
    } else if (event.key === 'Escape') {
        setIsPopoverOpen(false);
    }
   };

  const handleSubmit = () => {
    if (disabled) return;

    if (inputValue.trim()) {
      onSubmit(inputValue.trim()); // Trim the input before submitting
      setInputValue("");
      setIsPopoverOpen(false);
      setFilteredSuggestions([]);
    }
  };


  return (
    <div className={cn("flex items-start space-x-2", className)}> {/* items-start for multi-line */}
       <span className="text-muted-foreground font-mono text-sm shrink-0 pt-2">$</span> {/* Align prompt with first line */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverAnchor asChild>
                 <Textarea // Use Textarea instead of Input
                    ref={inputRef}
                    rows={3} // Set number of rows
                    placeholder={disabled ? "Processing..." : "Enter command (suggestions based on active categories)..."}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 font-mono resize-none" // Add resize-none
                    aria-autocomplete="list"
                    aria-controls="suggestion-list"
                    disabled={disabled}
                 />
            </PopoverAnchor>
           <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            side="bottom"
            avoidCollisions={false}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
               // Allow interaction if clicking inside the textarea itself
               if (e.target !== inputRef.current) {
                  setIsPopoverOpen(false);
               }
            }}
            >
            <CommandPrimitive shouldFilter={false}>
              <CommandList id="suggestion-list">
                <CommandEmpty>No matching commands in active categories.</CommandEmpty>
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => handleSuggestionClick(suggestion)}
                    className="cursor-pointer font-mono"
                    data-disabled={disabled}
                  >
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandList>
            </CommandPrimitive>
          </PopoverContent>
       </Popover>
      <Button onClick={handleSubmit} variant="default" size="icon" disabled={disabled} className="self-end mb-1"> {/* Align button bottom right */}
        <Terminal className="h-4 w-4" />
        <span className="sr-only">Execute Command</span>
      </Button>
    </div>
  );
}

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
function getFilename(): string {
    return 'command-input.tsx';
}
