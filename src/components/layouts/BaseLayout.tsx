
import { Card, CardContent } from "@/components/ui/card"
import NavigationBar from "@/components/NavigationBar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  variant?: 'default' | 'auth'
}

export default function BaseLayout({ 
  children, 
  title, 
  subtitle, 
  variant = 'default' 
}: BaseLayoutProps) {
  if (variant === 'auth') {
    return (
      <>
        <NavigationBar />
        
        <div className="mt-4 px-4">
          <Card className="w-full max-w-md mx-auto font-montserrat relative 
            bg-white/95
            border-[4px] border-black
            shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]
            hover:shadow-[6px_8px_0px_0px_rgba(0,0,0,0.95)]
            transition-all duration-300
            rounded-xl
            overflow-hidden
            group
            backdrop-blur-sm
          ">
            <div className="relative bg-white/80 rounded-lg">
              <CardContent className="p-6">
                {children}
              </CardContent>
            </div>
            
            {/* Sombra interna sutil */}
            <div className="absolute inset-[4px] pointer-events-none rounded-lg
              shadow-[inset_0px_0px_4px_rgba(0,0,0,0.05)]" 
            />
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <NavigationBar />
      
      <Card className="w-full max-w-3xl mx-auto font-montserrat relative 
        bg-white/95
        border-[4px] border-black
        shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]
        hover:shadow-[6px_8px_0px_0px_rgba(0,0,0,0.95)]
        transition-all duration-300
        rounded-xl
        overflow-hidden
        group
        backdrop-blur-sm
      ">
        <div className="relative bg-white/80 rounded-lg">
          {(title || subtitle) && (
            <div className="text-center py-6">
              {title && (
                <h1 className="text-3xl font-bold mb-2">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xl font-bold text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
          
          <CardContent>
            {children}
          </CardContent>
        </div>
        
        {/* Sombra interna sutil */}
        <div className="absolute inset-[4px] pointer-events-none rounded-lg
          shadow-[inset_0px_0px_4px_rgba(0,0,0,0.05)]" 
        />
      </Card>
    </>
  )
} 