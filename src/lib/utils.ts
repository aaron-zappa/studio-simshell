/src/lib/utils.ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Reads text from the user's clipboard.
 * @returns A promise that resolves with the clipboard text.
 * @throws An error if the clipboard API is not available or permission is denied.
 */
export async function readClipboard(): Promise<string> {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    throw new Error("Clipboard API not available or permission denied.");
  }
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error("Failed to read clipboard contents: ", err);
    throw new Error("Failed to read clipboard. Check browser permissions.");
  }
};
