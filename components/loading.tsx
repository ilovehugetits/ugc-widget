import { Loader2 } from "lucide-react"

export function Loading() {
  return (
    <div className="flex items-center justify-center h-[100vh]">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-lg font-medium text-muted-foreground">
          Loading...
        </span>
      </div>
    </div>
  )
}