import { useParams } from 'react-router-dom'

export default function MemoryDetail() {
  const { id } = useParams<{ id: string }>()
  return (
    <div>
      <h1>Memory Detail</h1>
      <p className="text-text-muted mt-2">ID: {id}</p>
    </div>
  )
}
