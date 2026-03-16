import { TagChart } from '@/components/tags/TagChart'
import { TagList } from '@/components/tags/TagList'

/**
 * Tags Explorer page — visualises tag distribution via a bar chart and
 * provides a sortable, searchable list of all tags. Every tag is clickable
 * and navigates to /search pre-filtered by that tag.
 */
export default function Tags() {
  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-text-heading">Tags Explorer</h1>
        <p className="mt-1 text-sm text-text-muted">
          Browse and visualise all tags — click any tag to search memories by it
        </p>
      </div>

      {/* Bar chart — full width */}
      <TagChart />

      {/* Sortable tag list */}
      <TagList />
    </div>
  )
}
