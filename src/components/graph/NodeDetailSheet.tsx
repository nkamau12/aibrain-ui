import { format } from 'date-fns'
import { Bot, Calendar, FolderOpen, GitBranch, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getClusterColor } from '@/lib/cluster-colors'
import type { GraphNode } from '@/types'

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

interface NodeDetailSheetProps {
  node: GraphNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Shortens a filesystem path to the last two segments so it fits in the
 * narrow metadata row without truncating silently. Falls back to the full
 * path if there are fewer than two segments.
 */
function shortenPath(path: string): string {
  if (!path) return ''
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean)
  if (segments.length <= 2) return path
  return `…/${segments.slice(-2).join('/')}`
}

/**
 * Formats an ISO date string into a human-readable form matching the style
 * used by MemoryDetail. Returns the raw string on parse failure so the UI
 * never shows an empty cell.
 */
function formatCreatedAt(isoString: string): string {
  try {
    return format(new Date(isoString), "MMM d, yyyy 'at' h:mm a")
  } catch {
    return isoString
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MetaRowItemProps {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}

/**
 * Single row in the metadata block — icon + accessible label + truncated value.
 * `mono` applies monospace styling for paths and IDs.
 */
function MetaRowItem({ icon, label, value, mono = false }: MetaRowItemProps) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground min-w-0">
      <span className="shrink-0 mt-0.5 opacity-60">{icon}</span>
      <span className="sr-only">{label}:</span>
      <span
        className={`truncate ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value || <em className="not-italic opacity-50">not set</em>}
      </span>
    </div>
  )
}

interface ClusterRowItemProps {
  cluster: string
}

/**
 * Cluster meta row with a deterministic color dot to match the graph node
 * color and the MemoryDetail ClusterMetaItem pattern.
 */
function ClusterRowItem({ cluster }: ClusterRowItemProps) {
  const color = getClusterColor(cluster)
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
      <span className="shrink-0 opacity-60">
        <Layers className="size-3.5" />
      </span>
      <span className="sr-only">Cluster:</span>
      <span
        className="shrink-0 size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate" title={cluster}>
        {cluster}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Slide-in Sheet panel that shows a lightweight preview of a graph node.
 *
 * This is intentionally NOT a full replica of MemoryDetail — it provides
 * just enough context (summary, metadata, tags, connections) to orient the
 * user before they decide whether to open the full detail page. Keeping it
 * lean ensures the panel renders instantly without additional API calls.
 *
 * The parent component (BrainGraph) is responsible for tracking which node
 * is selected and passing it here as `node`. When `node` is null the panel
 * renders nothing inside — base-ui's Dialog handles the open/close lifecycle
 * so the content unmounts cleanly on close.
 */
export function NodeDetailSheet({ node, open, onOpenChange }: NodeDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Override the default sm:max-w-sm with a fixed 400px to give the
        // metadata row enough room on desktop. On mobile the sheet is full-width
        // via the data-[side=right]:w-3/4 base style — we only widen on sm+.
        className="sm:w-[400px] sm:max-w-[400px] bg-popover flex flex-col gap-0 p-0"
      >
        {node && (
          <>
            {/* ── Header ───────────────────────────────────────────────── */}
            <SheetHeader className="px-4 pt-5 pb-4 border-b border-border">
              {/* SheetTitle doubles as the accessible dialog label */}
              <SheetTitle className="text-sm font-semibold text-foreground leading-snug pr-7 line-clamp-3">
                {node.summary}
              </SheetTitle>

              {/* SheetDescription provides secondary context for screen readers */}
              <SheetDescription className="text-xs text-muted-foreground">
                {node.cluster ? `Cluster: ${node.cluster}` : 'No cluster assigned'}
              </SheetDescription>
            </SheetHeader>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5 px-4 py-4 flex-1 overflow-y-auto">

              {/* Stale indicator — shown only when applicable */}
              {node.is_stale && (
                <div
                  className="
                    flex items-center gap-2 px-3 py-2 rounded-md
                    bg-amber-900/30 border border-amber-700/40
                  "
                  role="status"
                  aria-label="This memory is stale"
                >
                  <span className="size-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-amber-300 font-medium">
                    Stale — superseded by a newer memory
                  </span>
                </div>
              )}

              {/* Metadata ─────────────────────────────────────────────── */}
              <section aria-label="Node metadata">
                <div className="space-y-2">
                  {node.cluster && <ClusterRowItem cluster={node.cluster} />}

                  {node.projectPath && (
                    <MetaRowItem
                      icon={<FolderOpen className="size-3.5" />}
                      label="Project"
                      value={shortenPath(node.projectPath)}
                      mono
                    />
                  )}

                  {node.agentName && (
                    <MetaRowItem
                      icon={<Bot className="size-3.5" />}
                      label="Agent"
                      value={node.agentName}
                    />
                  )}

                  <MetaRowItem
                    icon={<Calendar className="size-3.5" />}
                    label="Created"
                    value={formatCreatedAt(node.createdAt)}
                  />

                  {node.connectionCount > 0 && (
                    <MetaRowItem
                      icon={<GitBranch className="size-3.5" />}
                      label="Connections"
                      value={`${node.connectionCount} connection${node.connectionCount !== 1 ? 's' : ''}`}
                    />
                  )}
                </div>
              </section>

              {/* Tags ──────────────────────────────────────────────────── */}
              {node.tags && node.tags.length > 0 && (
                <section aria-label="Tags">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {node.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="
                          bg-brand-amber-900/60 text-brand-amber-300
                          border border-brand-amber-700/40
                          hover:bg-brand-amber-800/60
                          cursor-default text-xs
                        "
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── Footer / Actions ─────────────────────────────────────── */}
            <div className="px-4 py-4 border-t border-border shrink-0">
              {/*
               * base-ui Button uses the `render` prop for polymorphism instead
               * of `asChild`. We pass a Link as the render target so the button
               * triggers React Router navigation rather than a full page load.
               */}
              <Button
                render={<Link to={`/memory/${node.id}`} />}
                className="w-full"
                size="sm"
              >
                View Full Detail
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
