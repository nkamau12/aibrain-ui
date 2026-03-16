import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Optional override for the fallback heading. Defaults to
   * "Something went wrong".
   */
  heading?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * React class component error boundary.
 *
 * Catches any rendering error that propagates up from its subtree, logs it to
 * the console, and renders a dark-themed fallback UI with a retry button that
 * resets the boundary and attempts to re-render the child tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 * Each page route should have its own ErrorBoundary so one broken page cannot
 * take down the whole shell.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log both the error and the React component stack so developers can trace
    // the origin of the failure without opening DevTools.
    console.error('[ErrorBoundary] Caught render error:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 p-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/15 border border-destructive/30">
            <AlertTriangle className="w-7 h-7 text-destructive" aria-hidden />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-heading">
              {this.props.heading ?? 'Something went wrong'}
            </h2>
            <p className="text-sm text-text-muted max-w-sm">
              An unexpected error occurred while rendering this page.
            </p>

            {/* Show the error message only in development so stack traces
                don't leak into production. */}
            {import.meta.env.DEV && (
              <pre className="mt-3 text-left text-xs text-brand-rose-400 bg-surface-2 border border-border rounded-lg p-4 max-w-xl overflow-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="border-border hover:border-brand-cyan-500/50 hover:text-brand-cyan-400 transition-colors"
          >
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
