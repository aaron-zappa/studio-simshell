// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/**
 * Returns the name of the current file.
 * @returns The filename.
 */
export function getFilename(): string {
    return 'skeleton.tsx';
}

export { Skeleton }
