import { AlertCircle } from "lucide-react"

export function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500 mt-1">
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  )
}