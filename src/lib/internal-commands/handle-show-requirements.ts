
'use server';

import type { OutputLine } from '@/components/output-display';
import * as fs from 'fs';
import * as path from 'path';

interface HandlerParams {
    args: string[];
    timestamp: string;
}

/**
 * Recursively finds all files with specified extensions in a directory.
 * @param dir - The directory to search in.
 * @param extensions - An array of file extensions to find (e.g., ['.ts', '.tsx']).
 * @param fileList - An array to accumulate the found file paths (used internally for recursion).
 * @returns An array of file paths relative to the project root.
 */
const findFilesByExtension = (
    dir: string,
    extensions: string[],
    fileList: string[] = []
): string[] => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Exclude node_modules and .next directories
            if (file !== 'node_modules' && file !== '.next') {
                findFilesByExtension(filePath, extensions, fileList);
            }
        } else if (extensions.includes(path.extname(file))) {
            // Store path relative to the project root (assuming execution from project root)
            fileList.push(path.relative(process.cwd(), filePath));
        }
    });

    return fileList;
};


/**
 * Handles the 'show requirements' command.
 * Displays all .ts and .tsx files within the 'src' directory in CSV format.
 * Ignores any arguments provided.
 */
export const handleShowRequirements = async ({ timestamp, args }: HandlerParams): Promise<OutputLine[]> => {
    let outputText = '';
    try {
        const srcDir = path.join(process.cwd(), 'src');
        const tsFiles = findFilesByExtension(srcDir, ['.ts', '.tsx']);

        if (tsFiles.length === 0) {
            outputText = 'No .ts or .tsx files found in the src directory.';
        } else {
             // Define CSV header
            const header = 'filename,type';
             // Create CSV rows
            const rows = tsFiles.map(file =>
                // Basic CSV formatting, quoting filename if it contains commas
                `${file.includes(',') ? `"${file}"` : file},typescript_file`
            ).join('\n');
            outputText = header + '\n' + rows + `\n(${tsFiles.length} files found)`;
        }

    } catch (error) {
        console.error("Error finding files for 'show requirements':", error);
        outputText = `Error generating file list: ${error instanceof Error ? error.message : 'Unknown error'}`;
         return [{
            id: `req-error-${timestamp}`,
            text: outputText,
            type: 'error',
            category: 'internal'
        }];
    }

    // TODO: Handle arguments if needed (e.g., filtering)
    if (args.length > 0) {
        console.warn("'show requirements' currently ignores arguments:", args);
    }

    return [{
        id: `req-output-${timestamp}`,
        text: outputText,
        type: 'output',
        category: 'internal'
    }];
};
