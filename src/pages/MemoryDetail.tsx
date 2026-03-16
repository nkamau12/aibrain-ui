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

  if (isLoading) {
    return <MemoryDetailSkeleton />
  }

  if (isError || !memory) {
    return <MemoryNotFoundState />
  }

  return <MemoryDetailView memory={memory} />
}
