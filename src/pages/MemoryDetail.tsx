import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMemory } from '@/hooks/useMemories'
import {
  MemoryDetail as MemoryDetailView,
  MemoryDetailSkeleton,
  MemoryNotFoundState,
} from '@/components/memories/MemoryDetail'

export default function MemoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: memory, isLoading, isError } = useMemory(id)

  useEffect(() => {
    document.title = memory?.summary
      ? `${memory.summary.slice(0, 60)} — aiBrain`
      : 'Memory — aiBrain'
  }, [memory])

  if (isLoading) {
    return <MemoryDetailSkeleton />
  }

  if (isError || !memory) {
    return <MemoryNotFoundState />
  }

  return <MemoryDetailView memory={memory} />
}
