"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command as CommandPrimitive, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command"; // Use ShadCN Command
import { cn } from "@/lib/utils";
import { Terminal } from 'lucide-react';
// type CommandMode removed as import

interface CommandInputProps {
  onSubmit: (command: string) => void;
  suggestions: string[]; // List of possible commands/subcommands from potentially all modes
  // currentMode?: CommandMode; // Removed currentMode prop
  className?: string;
  disabled?: boolean;
}

// Removed currentMode from props destructuring
export function CommandInput({ onSubmit, suggestions, className, disabled = false }: CommandInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    // Simplified: just set the suggestion, specific mode logic removed
    setInputValue(suggestion + " ");
    setIsPopoverOpen(false);
    setFilteredSuggestions([]);
    inputRef.current?.focus();
  };

   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === 'Enter') {
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
      onSubmit(inputValue);
      setInputValue("");
      setIsPopoverOpen(false);
      setFilteredSuggestions([]);
    }
  };

  // Removed getModeDisplay function

  return (
    <div className={cn("flex items-center space-x-2", className)}>
       {/* Removed mode display span */}
       {/* <span className="text-muted-foreground font-mono text-sm shrink-0">{getModeDisplay()} $</span> */}
       <span className="text-muted-foreground font-mono text-sm shrink-0">$</span> {/* Default prompt */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverAnchor asChild>
                 <Input
                    ref={inputRef}
                    type="text"
                    placeholder={disabled ? "Processing..." : "Enter command..."}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 font-mono"
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
               if (e.target !== inputRef.current) {
                  setIsPopoverOpen(false);
               }
            }}
            >
            <CommandPrimitive shouldFilter={false}>
              <CommandList id="suggestion-list">
                <CommandEmpty>No matching commands.</CommandEmpty>
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => handleSuggestionClick(suggestion)}
                    className="cursor-pointer font-mono"
                    data-disabled={disabled}
                  >
                    {/* Removed mode-specific display logic for suggestions */}
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandList>
            </CommandPrimitive>
          </PopoverContent>
       </Popover>
      <Button onClick={handleSubmit} variant="default" size="icon" disabled={disabled}>
        <Terminal className="h-4 w-4" />
        <span className="sr-only">Execute Command</span>
      </Button>
    </div>
  );
}