import { Toast } from "@/components/ui/toast"

type ToastProps = React.ComponentProps<typeof Toast>

export function useToast() {
  const toast = (props: Partial<ToastProps>) => {
    // Implementação básica do toast
    console.log('Toast:', props)
  }

  return {
    toast
  }
} 