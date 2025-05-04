// src/lib/utils.ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
export function getFilename(): string {
    return 'utils.ts';
}
