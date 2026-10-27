
import Link from "next/link";

const footerLinks = [
  { href: "/sobre", label: "Sobre" },
  { href: "/faq", label: "FAQ" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/lgpd", label: "LGPD" },
  { href: "/contato", label: "Contato" },
  { href: "/transparencia", label: "Transparência" },
];

export default function AboutModalTrigger() {
  return (
    <div
      className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs sm:text-sm max-w-xs mx-auto sm:max-w-none"
      style={{ rowGap: "0.25rem" }}
    >
      {footerLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="underline hover:text-black transition-colors font-semibold"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
