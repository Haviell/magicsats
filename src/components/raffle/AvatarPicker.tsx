import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

/** Foto de perfil privada: salva em avatars/<userId>/avatar e exibida via URL assinada. */
export function AvatarPicker({ fallback, enabled }: { fallback: string; enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setUrl(null)
    const { data } = await supabase.storage.from('avatars').createSignedUrl(`${user.id}/avatar`, 3600)
    setUrl(data?.signedUrl ? `${data.signedUrl}&t=${Date.now()}` : null)
  }

  useEffect(() => { if (enabled) load(); else setUrl(null) }, [enabled])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      alert('Envie uma imagem de até 2MB.')
      return
    }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.storage.from('avatars')
        .upload(`${user.id}/avatar`, file, { upsert: true, contentType: file.type })
      if (error) alert('Não foi possível enviar a foto.')
      else await load()
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      disabled={!enabled || busy}
      onClick={() => input.current?.click()}
      title={enabled ? 'Trocar foto de perfil' : undefined}
      className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg border-2 border-white/20 overflow-hidden group"
    >
      {url ? (
        <img src={url} alt="Foto de perfil" className="w-full h-full object-cover" onError={() => setUrl(null)} />
      ) : (
        <span className="font-extrabold text-lg text-white">{fallback}</span>
      )}
      {enabled && (
        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera className="w-4 h-4 text-white" />
        </span>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </button>
  )
}
