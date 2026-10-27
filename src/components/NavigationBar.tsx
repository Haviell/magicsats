
import { Share, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./ui/button"
import { usePathname, useRouter, useSearchParams } from '@/lib/next-compat'
import { useRoundAccess } from '@/hooks/use-round-access'
import { useToast } from '@/hooks/use-toast'

export default function NavigationBar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openRound, nextRoundAccess, loading: accessLoading, getAccess } = useRoundAccess()
  const { toast } = useToast()

  const getCurrentRound = () => {
    const roundParam = searchParams.get('round')
    return roundParam ? parseInt(roundParam) : (openRound ?? 1)
  }

  const getPageTitle = () => {
    switch (pathname) {
      case '/rifa':
        const currentRound = getCurrentRound()
        return `/rifa_${currentRound}`
      case '/sobre':
        return '/sobre'
      case '/faq':
        return '/faq'
      case '/termos':
        return '/termos'
      case '/privacidade':
        return '/privacidade'
      case '/lgpd':
        return '/lgpd'
      case '/contato':
        return '/contato'
      case '/transparencia':
        return '/transparencia'
      default:
        return '/magicsats.digital'
    }
  }

  const navigateToRound = (roundNumber: number) => {
    if (roundNumber < 0) return // Não permitir rounds negativos
    router.push(`/rifa?round=${roundNumber}`, { scroll: false })
  }

  const handlePreviousRound = () => {
    const currentRound = getCurrentRound();
    if (currentRound > 0) {
      navigateToRound(currentRound - 1);
    }
  }

  const handleNextRound = async () => {
    const currentRound = getCurrentRound();
    const targetRound = currentRound + 1
    try {
      const access = await getAccess(targetRound)
      if (!access.canView) {
        toast({
          title: "Próxima rifa indisponível",
          description: "A rodada atual ainda não terminou. O acesso antecipado é exclusivo do vencedor.",
          variant: "destructive",
        })
        return
      }
      navigateToRound(targetRound)
    } catch (error) {
      toast({
        title: "Não foi possível verificar o acesso",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    }
  }

  // Função para criar efeito ripple
  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.5
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2

    const ripple = document.createElement('span')
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(0, 0, 0, 0.15);
      border-radius: 50%;
      transform: scale(0);
      animation: nav-ripple 0.4s ease-out;
      pointer-events: none;
      z-index: 10;
    `

    button.appendChild(ripple)

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.remove()
      }
    }, 400)
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Magic Sats',
          text: 'Confira o Magic Sats!',
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        alert('Link copiado para a área de transferência!')
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
    }
  }

  const currentRound = getCurrentRound()
  const isRifaPage = pathname === '/rifa'
  const canGoNext =
    openRound !== null &&
    (currentRound < openRound ||
      (currentRound === openRound && nextRoundAccess?.canView === true))

  return (
    <div className="w-[80vw] max-w-[380px] sm:w-[380px] absolute left-1/2 -translate-x-1/2 -top-2 z-10 mt-3 px-1 sm:px-0">
      <div className="bg-white/95 backdrop-blur-sm
        border-[3px] border-black
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]
        transition-all duration-300
        overflow-hidden
        group
        flex items-center
      ">
        {/* Botões de Navegação - apenas na página da rifa */}
        {isRifaPage && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                createRipple(e)
                // Feedback tátil para dispositivos móveis
                if (navigator.vibrate) {
                  navigator.vibrate(50)
                }
                handlePreviousRound()
              }}
              disabled={currentRound <= 0}
              className="h-7 w-7 rounded-none border-r-[3px] border-black
                bg-gradient-to-b from-gray-50 to-gray-100
                hover:bg-gradient-to-b hover:from-gray-100 hover:to-gray-200
                active:bg-gradient-to-b active:from-gray-200 active:to-gray-300
                active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed
                disabled:hover:bg-gradient-to-b disabled:hover:from-gray-50 disabled:hover:to-gray-100
                disabled:active:scale-100
                transition-all duration-150 ease-out
                relative overflow-hidden"
            >
              <ChevronLeft className="h-4 w-4 transition-transform duration-150 active:scale-90" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                createRipple(e)
                // Feedback tátil para dispositivos móveis
                if (navigator.vibrate) {
                  navigator.vibrate(50)
                }
                void handleNextRound()
              }}
              disabled={accessLoading}
              aria-disabled={!canGoNext}
              title={canGoNext ? "Próxima rodada" : "A próxima rodada ainda não está liberada"}
              className={`h-7 w-7 rounded-none border-r-[3px] border-black
                bg-gradient-to-b from-gray-50 to-gray-100
                hover:bg-gradient-to-b hover:from-gray-100 hover:to-gray-200
                active:bg-gradient-to-b active:from-gray-200 active:to-gray-300
                active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed
                ${!canGoNext ? 'opacity-50 cursor-not-allowed' : ''}
                transition-all duration-150 ease-out
                relative overflow-hidden`}
            >
              <ChevronRight className="h-4 w-4 transition-transform duration-150 active:scale-90" />
            </Button>
          </>
        )}

        <div className="flex-1 flex items-center h-7">
          <span className="text-sm font-medium px-3 select-none">{getPageTitle()}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
          className="h-7 w-9 rounded-none hover:bg-secondary/50 border-l-[3px] border-black px-2"
        >
          <Share className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}