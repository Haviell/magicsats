import { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

// Lista de emojis e informações do FAQ
const faqItems = [
  {
    emoji: '💡',
    question: 'Como funciona o sorteio?',
    answer: 'O sorteio é realizado de forma transparente usando blockchain, garantindo total aleatoriedade e impossibilidade de manipulação.'
  },
  {
    emoji: '🎲',
    question: 'Quais são minhas chances?',
    answer: 'Suas chances aumentam conforme o número de tickets comprados. Cada ticket representa 1% de chance de ganhar.'
  },
  {
    emoji: '💰',
    question: 'Como recebo o prêmio?',
    answer: 'O prêmio é enviado automaticamente para sua carteira Bitcoin em até 24 horas após o sorteio.'
  },
  {
    emoji: '⏰',
    question: 'Quando acontece o sorteio?',
    answer: 'O sorteio acontece assim que todos os tickets são vendidos, com transmissão ao vivo nas nossas redes sociais.'
  },
  {
    emoji: '🔒',
    question: 'O sorteio é seguro?',
    answer: 'Sim! Utilizamos smart contracts na blockchain para garantir total transparência e segurança no processo.'
  },
  {
    emoji: '💳',
    question: 'Quais formas de pagamento?',
    answer: 'Aceitamos PIX, transferência bancária, e pagamentos em Bitcoin (on-chain e Lightning Network).'
  },
  {
    emoji: '🎫',
    question: 'Posso comprar vários números?',
    answer: 'Sim! Não há limite de números por pessoa, quanto mais números, maiores suas chances.'
  },
  {
    emoji: '📱',
    question: 'Como acompanho o sorteio?',
    answer: 'Você pode acompanhar ao vivo pelo nosso canal no YouTube e recebe notificações por WhatsApp.'
  },
  {
    emoji: '🔄',
    question: 'Posso transferir meu número?',
    answer: 'Não, os números são pessoais e intransferíveis após a compra para garantir a segurança do sorteio.'
  },
  {
    emoji: '❓',
    question: 'E se não vender todos os números?',
    answer: 'Caso não sejam vendidos todos os números em 30 dias, o valor é devolvido integralmente aos participantes.'
  }
]

export function FAQ() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(true)
  const [isChanging, setIsChanging] = useState(false)

  const handleNextItem = () => {
    if (isChanging) return // Previne múltiplos cliques durante a transição

    setIsChanging(true)
    setIsOpen(false) // Fecha o tooltip atual

    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % faqItems.length)
      setIsOpen(true) // Abre o novo tooltip
      setIsChanging(false)
    }, 1000)
  }

  const currentItem = faqItems[currentIndex]

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex justify-center items-center p-4">
        <Tooltip open={isOpen} onOpenChange={setIsOpen}>
          <TooltipTrigger asChild>
            <button 
              className={`text-4xl transition-all duration-300 p-4
                ${isChanging 
                  ? 'opacity-50 cursor-not-allowed scale-95' 
                  : 'hover:scale-110'
                }`}
              onClick={handleNextItem}
              disabled={isChanging}
            >
              {currentItem.emoji}
            </button>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-popover border shadow-lg p-4"
            sideOffset={5}
          >
            <div className="max-w-xs">
              <h3 className="font-bold mb-2">{currentItem.question}</h3>
              <p>{currentItem.answer}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
} 