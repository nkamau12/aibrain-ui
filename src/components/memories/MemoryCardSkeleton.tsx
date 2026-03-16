import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Placeholder card rendered while memory data is loading.
 * Mirrors MemoryCard's visual dimensions so the grid doesn't reflow on load.
 */
export function MemoryCardSkeleton() {
  return (
    <Card className="bg-surface border-border/60">
      {/* Summary block — 3 lines */}
      <CardContent className="pt-4 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[90%]" />
        <Skeleton className="h-3.5 w-[70%]" />
      </CardContent>

      {/* Tags row */}
      <CardContent className="pt-0">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="justify-between bg-transparent border-t border-border/40 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </CardFooter>
    </Card>
  )
}
