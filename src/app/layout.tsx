import type {Metadata} from 'next';
import { Inter } from "next/font/google"; // Using Inter as a fallback example if needed, but Geist is primary
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css';
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SimuShell',
  description: 'Simulate Python, Unix, Windows, and SQL commands',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable
        )}
       >
        {children}
        <Toaster /> {/* Add Toaster for potential notifications */}
      </body>
    </html>
  );
}
