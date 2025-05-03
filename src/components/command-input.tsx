
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command as CommandPrimitive, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command"; // Use ShadCN Command
import { cn } from "@/lib/utils";
import { Terminal } from 'lucide-react';
import type { CommandMode } from '@/types/command-types'; // Import shared type

interface CommandInputProps {
  onSubmit: (command: string) => void;
  suggestions: string[]; // List of possible commands/subcommands
  currentMode?: CommandMode; // Use imported CommandMode
  className?: string;
}

export function CommandInput({ onSubmit, suggestions, currentMode, className }: CommandInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);

    if (value.trim().length > 0) {
      const lowerCaseValue = value.toLowerCase();
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
    // Handle specific suggestion format for 'add internal command'
    if (suggestion.startsWith('add internal command "<name>"')) {
       setInputValue('add internal command "" ');
    } else {
       setInputValue(suggestion + " "); // Add space after suggestion
    }
    setIsPopoverOpen(false);
    setFilteredSuggestions([]);
    inputRef.current?.focus(); // Refocus input after selection
  };

   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
        handleSubmit();
    } else if (event.key === 'Tab' && filteredSuggestions.length > 0) {
        event.preventDefault(); // Prevent default tab behavior
        handleSuggestionClick(filteredSuggestions[0]); // Autocomplete with the first suggestion
    } else if (event.key === 'Escape') {
        setIsPopoverOpen(false);
    }
   };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue);
      setInputValue(""); // Clear input after submit
      setIsPopoverOpen(false);
      setFilteredSuggestions([]);
    }
  };

  // Helper to get mode display text
  const getModeDisplay = () => {
    switch (currentMode) {
      case 'python': return '[Py]';
      case 'unix': return '[Ux]';
      case 'windows': return '[Win]';
      case 'sql': return '[SQL]';
      default: return '[Int]';
    }
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
       <span className="text-muted-foreground font-mono text-sm shrink-0">{getModeDisplay()} $</span>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverAnchor asChild>
                 <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter command..."
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 font-mono" // Use monospace font
                    aria-autocomplete="list"
                    aria-controls="suggestion-list"
                 />
            </PopoverAnchor>
           <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            side="bottom"
            avoidCollisions={false} // Allow it to overlay input if needed
            onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
            onInteractOutside={(e) => {
               // Only close if the click is not on the input itself
               if (e.target !== inputRef.current) {
                  setIsPopoverOpen(false);
               }
            }}
            >
            <CommandPrimitive shouldFilter={false}> {/* Disable internal filtering */}
              <CommandList id="suggestion-list">
                <CommandEmpty>No matching commands.</CommandEmpty>
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion} // value is needed for CommandItem
                    onSelect={() => handleSuggestionClick(suggestion)}
                    className="cursor-pointer font-mono"
                  >
                     {/* Display suggestion format for 'add internal command' properly */}
                     {suggestion === 'add internal command "<name>" <action>' ? 'add internal command "<name>" <action>' : suggestion}
                  </CommandItem>
                ))}
              </CommandList>
            </CommandPrimitive>
          </PopoverContent>
       </Popover>
      <Button onClick={handleSubmit} variant="default" size="icon">
        <Terminal className="h-4 w-4" />
        <span className="sr-only">Execute Command</span>
      </Button>
    </div>
  );
}
