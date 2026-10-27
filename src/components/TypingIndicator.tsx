
interface TypingIndicatorProps {
  isTyping: boolean
  username: string
}

export default function TypingIndicator({ isTyping, username }: TypingIndicatorProps) {
  if (!isTyping) return null

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500 animate-pulse">
      <span>{username} está digitando</span>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
} 