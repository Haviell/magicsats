import * as React from "react"

interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={`rounded-md border p-4 ${
          variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-background"
        }`}
      >
        {title && <div className="font-medium">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
    )
  }
)
Toast.displayName = "Toast" 