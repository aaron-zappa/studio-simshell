// src/ai/flows/list-all-tables-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow that provides a SQL query to list all tables.
 *
 * - listAllTablesQuery - A function that returns a SQL query string for listing all tables.
 * - ListAllTablesQueryOutput - The return type for the listAllTablesQuery function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ListAllTablesQueryOutputSchema = z.object({
  sqlQuery: z.string().describe('The SQL query string to list all tables in the database.'),
});
export type ListAllTablesQueryOutput = z.infer<typeof ListAllTablesQueryOutputSchema>;

export async function listAllTablesQuery(): Promise<ListAllTablesQueryOutput> {
  return listAllTablesFlow({});
}

const listAllTablesFlow = ai.defineFlow(
  {
    name: 'listAllTablesFlow',
    inputSchema: z.object({}), // No input required
    outputSchema: ListAllTablesQueryOutputSchema,
  },
  async () => {
    // Standard SQL query to list all tables from the information schema
    // This is a common way to get table names, though exact syntax might vary slightly per SQL dialect.
    // For SQLite, a common approach is: SELECT name FROM sqlite_master WHERE type='table';
    // However, INFORMATION_SCHEMA.TABLES is more standard across different SQL databases.
    // We will provide the more general one first, and it can be adapted if a specific dialect is in use.
    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
    // const query = "SELECT * FROM INFORMATION_SCHEMA.TABLES;";
    return { sqlQuery: query };
  }
);

// Export the flow directly
export { listAllTablesFlow };

/**
 * Returns the name of the current file.
 * This function is not exported to avoid being treated as a Server Action.
 * @returns The filename.
 */
function getFilename(): string {
    return 'list-all-tables-flow.ts';
}
