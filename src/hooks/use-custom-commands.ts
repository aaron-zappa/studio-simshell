// src/hooks/use-custom-commands.ts
'use client';

import * as React from 'react';

export type CustomCommandAction = string; // For now, action is just a string to be echoed

export type CustomCommands = Record<string, CustomCommandAction>;

export const useCustomCommands = () => {
  const [customCommands, setCustomCommands] = React.useState<CustomCommands>({});

  const addCustomCommand = React.useCallback((name: string, action: CustomCommandAction) => {
    setCustomCommands((prev) => ({
      ...prev,
      [name.toLowerCase()]: action, // Store command names in lowercase for case-insensitivity
    }));
  }, []);

  const getCustomCommandAction = React.useCallback(
    (name: string): CustomCommandAction | undefined => {
      return customCommands[name.toLowerCase()];
    },
    [customCommands]
  );

  return { customCommands, addCustomCommand, getCustomCommandAction };
};
