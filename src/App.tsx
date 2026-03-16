import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

/**
 * Phase 1 verification page — confirms the following work end-to-end:
 *   - Dark gradient background (Tasks 1.1 + 1.2)
 *   - Custom color palette via Tailwind utilities (Task 1.2)
 *   - shadcn Button, Card, Badge, Input components (Task 1.3)
 *   - Sonner toast on button click (Task 1.3)
 *
 * This file will be replaced with the real app shell in Task 1.4.
 */
function App() {
  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-text-heading">aibrain-ui</h1>
        <p className="text-text-muted text-sm">
          Phase 1 scaffold — dark theme + shadcn verified
        </p>
      </div>

      {/* Card demonstrating the dark theme + custom palette */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Memory Browser</CardTitle>
          <CardDescription>
            Browse and search your aiBrain memories
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Color palette badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="border-brand-cyan-500 text-brand-cyan-400"
            >
              architecture
            </Badge>
            <Badge
              variant="outline"
              className="border-brand-amber-500 text-brand-amber-400"
            >
              bug-fix
            </Badge>
            <Badge
              variant="outline"
              className="border-brand-rose-500 text-brand-rose-400"
            >
              in-progress
            </Badge>
          </div>

          {/* Search input */}
          <Input placeholder="Search memories..." />

          {/* Muted text sample */}
          <p className="text-text-muted text-xs">
            Showing 24 memories across 3 projects
          </p>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            onClick={() =>
              toast.success('Toast works!', {
                description: 'Sonner is mounted and dark-themed correctly.',
              })
            }
          >
            Test Toast
          </Button>
          <Button variant="outline">Secondary Action</Button>
          <Button
            variant="destructive"
            onClick={() =>
              toast.error('Delete memory?', {
                description: 'This action cannot be undone.',
              })
            }
          >
            Delete
          </Button>
        </CardFooter>
      </Card>

      {/* Surface color swatches */}
      <div className="flex gap-3">
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px] text-text-muted"
          style={{ background: '#0f0f1a' }}
        >
          bg-base
        </div>
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px] text-text-muted"
          style={{ background: '#1a1a2e' }}
        >
          bg-deep
        </div>
        <div className="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-[10px] text-text-muted">
          surface
        </div>
        <div className="w-16 h-16 rounded-lg bg-surface-2 flex items-center justify-center text-[10px] text-text-muted">
          surface-2
        </div>
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px]"
          style={{ background: '#00d9ff', color: '#000' }}
        >
          cyan-500
        </div>
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px]"
          style={{ background: '#ffd93d', color: '#000' }}
        >
          amber-500
        </div>
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px]"
          style={{ background: '#ff6b6b', color: '#000' }}
        >
          rose-500
        </div>
      </div>
    </div>
  )
}

export default App
