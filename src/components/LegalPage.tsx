import Link from '@/lib/next-compat'
import { legalPages } from '@/lib/legal-content'

const menu = [
  { href: '/sobre', label: 'Sobre' },
  { href: '/faq', label: 'FAQ' },
  { href: '/termos', label: 'Termos de uso' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/lgpd', label: 'LGPD' },
  { href: '/contato', label: 'Contato' },
  { href: '/transparencia', label: 'Transparência' },
] as const

export default function LegalPage({ slug }: { slug: keyof typeof legalPages }) {
  const page = legalPages[slug]

  return (
    <main className="container mx-auto px-4 pt-16 pb-10">
      <article className="mx-auto max-w-3xl rounded-xl border-[4px] border-black bg-white p-6 shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="mb-6 text-center text-3xl font-bold">{page.title}</h1>
        <nav className="mb-6 flex flex-wrap justify-center gap-3 text-sm">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`underline ${item.href === `/${slug}` ? 'font-bold text-black' : 'text-black/60 hover:text-black'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-5 text-sm leading-relaxed text-black/80">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-1 text-base font-semibold text-black">{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/rifa" className="text-sm font-semibold underline">
            Voltar para a rifa
          </Link>
        </div>
      </article>
    </main>
  )
}
