import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <Loader2 className="h-12 w-12 animate-spin text-gray-800" />
      <p className="mt-4 text-lg font-medium text-gray-800">Loading...</p>
    </div>
  )
}

