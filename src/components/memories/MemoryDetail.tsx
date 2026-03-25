import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { Trash2, ArrowLeft, AlertCircle, Bot, Hash, FolderOpen, Calendar, Layers, Network } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDeleteMemory, useRelatedMemories } from '@/hooks/useMemories'
import { getClusterColor } from '@/lib/cluster-colors'
import type { Memory } from '@/types'

// ---------------------------------------------------------------------------
// Relation type helpers
// ---------------------------------------------------------------------------

const RELATION_TYPE_LABELS: Record<string, string> = {
  supersedes: 'Supersedes',
  'caused-by': 'Caused by',
  'see-also': 'See also',
  'follow-up': 'Follow-up',
  similar: 'Similar',
}

const RELATION_TYPE_ORDER = ['supersedes', 'caused-by', 'follow-up', 'see-also', 'similar']

function getRelationLabel(relationType: string): string {
  return RELATION_TYPE_LABELS[relationType] ?? relationType
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function MemoryDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <Skeleton className="h-7 w-24" />

      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-44" />
      </div>

      {/* Tags */}
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      {/* Content */}
      <div className="space-y-3 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 404 / Error states
// ---------------------------------------------------------------------------

interface NotFoundStateProps {
  message?: string
}

export function MemoryNotFoundState({ message }: NotFoundStateProps) {
  const navigate = useNavigate()
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
      <AlertCircle className="size-12 text-brand-rose-400" />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text-heading">Memory not found</h2>
        <p className="text-sm text-text-muted">
          {message ?? 'This memory may have been deleted or the link is invalid.'}
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate('/')}>
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  open: boolean
  memorySummary: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

function DeleteConfirmDialog({
  open,
  memorySummary,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this memory?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The following memory will be permanently removed from
            LanceDB:
          </DialogDescription>
        </DialogHeader>

        {/* Memory summary preview */}
        <blockquote className="border-l-2 border-brand-rose-600 pl-3 py-1 text-sm text-text-body italic line-clamp-4">
          {memorySummary}
        </blockquote>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Metadata row item
// ---------------------------------------------------------------------------

interface MetaItemProps {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}

function MetaItem({ icon, label, value, mono = false }: MetaItemProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
      <span className="shrink-0 text-text-muted/70">{icon}</span>
      <span className="sr-only">{label}:</span>
      <span
        className={`truncate ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value || <em className="not-italic text-text-muted/50">not set</em>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cluster meta item — icon + color dot + name
// ---------------------------------------------------------------------------

interface ClusterMetaItemProps {
  cluster: string
}

function ClusterMetaItem({ cluster }: ClusterMetaItemProps) {
  const color = getClusterColor(cluster)
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
      <span className="shrink-0 text-text-muted/70">
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
// Stale badge
// ---------------------------------------------------------------------------

function StaleBadge() {
  return (
    <Badge
      className="
        bg-amber-900/50 text-amber-300
        border border-amber-700/50
        cursor-default text-xs font-medium
      "
    >
      Stale
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Related memories section
// ---------------------------------------------------------------------------

interface RelatedMemoriesSectionProps {
  memoryId: string
}

function RelatedMemoriesSkeletons() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border-l-2 border-border/60 pl-3 py-1 space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

function RelatedMemoriesSection({ memoryId }: RelatedMemoriesSectionProps) {
  const { data, isLoading } = useRelatedMemories(memoryId, {
    depth: 2,
    include_content: false,
  })

  const nodes = data?.nodes ?? []

  // Group related memories by their relation type relative to the root.
  // The API returns flat nodes; we recover the relation_type by looking at
  // the root's related_ids. Nodes not referenced there are labelled "similar".
  const rootRelatedIds = data?.root?.related_ids ?? []
  const relatedIdMap = new Map(rootRelatedIds.map((r) => [r.id, r.relation_type]))

  // Group nodes by relation type
  const grouped = new Map<string, Memory[]>()
  for (const node of nodes) {
    const relationType = relatedIdMap.get(node.id) ?? 'similar'
    const existing = grouped.get(relationType) ?? []
    grouped.set(relationType, [...existing, node])
  }

  return (
    <section aria-labelledby="related-memories-heading" className="mt-10 pt-6 border-t border-border/40">
      <h2
        id="related-memories-heading"
        className="text-sm font-semibold text-text-heading mb-4"
      >
        Related Memories
      </h2>

      {isLoading && <RelatedMemoriesSkeletons />}

      {!isLoading && nodes.length === 0 && (
        <p className="text-sm text-text-muted italic">No related memories.</p>
      )}

      {!isLoading && nodes.length > 0 && (
        <div className="space-y-5">
          {RELATION_TYPE_ORDER.filter((rt) => grouped.has(rt)).map((relationType) => (
            <div key={relationType}>
              <p className="text-xs font-medium text-text-muted mb-2">
                {getRelationLabel(relationType)}
              </p>
              <div className="space-y-1.5">
                {(grouped.get(relationType) ?? []).map((node) => (
                  <RelatedMemoryRow key={node.id} memory={node} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface RelatedMemoryRowProps {
  memory: Memory
}

function RelatedMemoryRow({ memory }: RelatedMemoryRowProps) {
  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })
    } catch {
      return memory.createdAt
    }
  })()

  return (
    <Link
      to={`/memory/${memory.id}`}
      className="
        block border-l-2 border-border/60 pl-3 py-1.5
        rounded-r-sm
        hover:border-border hover:bg-surface/50
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        group
      "
    >
      <p className="text-sm text-text-body leading-snug line-clamp-2 group-hover:text-text-heading transition-colors">
        {memory.summary}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">{relativeTime}</p>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface MemoryDetailProps {
  memory: Memory
}

/**
 * Renders the full detail view for a single memory: markdown content,
 * metadata (including cluster), stale badge, tags, related memories, and
 * delete with confirmation.
 *
 * Intentionally a pure presentational component — the page that mounts it
 * is responsible for data fetching via useMemory(id).
 */
function safeGoBack(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) {
    navigate(-1)
  } else {
    navigate('/')
  }
}

export function MemoryDetail({ memory }: MemoryDetailProps) {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteMutation = useDeleteMemory()

  const formattedDate = (() => {
    try {
      return format(new Date(memory.createdAt), "MMMM d, yyyy 'at' h:mm a")
    } catch {
      return memory.createdAt
    }
  })()

  function handleDeleteConfirm() {
    deleteMutation.mutate(memory.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        toast.success('Memory deleted successfully')
        safeGoBack(navigate)
      },
      onError: (error) => {
        toast.error(`Failed to delete memory: ${error.message}`)
      },
    })
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation bar */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => safeGoBack(navigate)}
            className="gap-1.5 text-text-muted hover:text-text-body"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Link
              to={`/graph?focus=${memory.id}`}
              className="
                inline-flex items-center gap-1.5 rounded-md px-3 py-1.5
                text-sm font-medium text-text-muted
                hover:text-text-body hover:bg-surface
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              "
            >
              <Network className="size-3.5" />
              View in Graph
            </Link>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Summary / title + stale badge */}
        <header className="mb-6 flex flex-wrap items-start gap-3">
          <h1 className="flex-1 text-xl font-semibold text-text-heading leading-snug">
            {memory.summary}
          </h1>
          {memory.is_stale && <StaleBadge />}
        </header>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 pb-4 border-b border-border/40">
          <MetaItem icon={<Bot className="size-3.5" />} label="Agent" value={memory.agentName} />
          <MetaItem icon={<Hash className="size-3.5" />} label="Session" value={memory.sessionId} mono />
          <MetaItem
            icon={<FolderOpen className="size-3.5" />}
            label="Project"
            value={memory.projectPath}
            mono
          />
          <MetaItem
            icon={<Calendar className="size-3.5" />}
            label="Created"
            value={formattedDate}
          />
          {memory.cluster && <ClusterMetaItem cluster={memory.cluster} />}
        </div>

        {/* Tags */}
        {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {memory.tags.map((tag) => (
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
        )}

        {/* Markdown content */}
        {memory.content ? (
          <div className="prose-memory">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {memory.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">No content available.</p>
        )}

        {/* Related memories */}
        <RelatedMemoriesSection memoryId={memory.id} />
      </div>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        memorySummary={memory.summary}
        isDeleting={deleteMutation.isPending}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
