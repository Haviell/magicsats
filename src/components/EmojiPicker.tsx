
import { useState } from 'react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

type EmojiCategory = 'Expressões' | 'Gestos' | 'Símbolos' | 'Jogos'

// Categorias de emojis mais usados em jogos
const emojiCategories: Record<EmojiCategory, string[]> = {
  'Expressões': ['😀', '😂', '😅', '😊', '😎', '🤔', '😴', '😭', '😡', '🤯'],
  'Gestos': ['👍', '👎', '👊', '✌️', '🤝', '👋', '🙏', '💪', '🤙', '👏'],
  'Símbolos': ['❤️', '💯', '🔥', '⭐', '💫', '💥', '✨', '💪', '🎯', '🎲'],
  'Jogos': ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎪', '🎫', '🏆', '🥇']
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<EmojiCategory>('Expressões')

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-64">
      {/* Categorias */}
      <div className="flex border-b border-gray-200">
        {(Object.keys(emojiCategories) as EmojiCategory[]).map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex-1 p-2 text-sm hover:bg-gray-50 transition-colors ${
              selectedCategory === category ? 'bg-gray-100' : ''
            }`}
          >
            {emojiCategories[category][0]}
          </button>
        ))}
      </div>

      {/* Grid de Emojis */}
      <div className="p-2 grid grid-cols-5 gap-1">
        {emojiCategories[selectedCategory].map((emoji: string, index: number) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="p-2 text-xl hover:bg-gray-100 rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
} 