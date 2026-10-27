// Small adapter so components ported from the original app keep their
// navigation calls while running on TanStack Router.
import { Link as TLink, useLocation, useRouter as useTRouter } from "@tanstack/react-router";
import { useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";

export function usePathname() {
  return useLocation({ select: (l) => l.pathname });
}

export function useSearchParams() {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function useRouter() {
  const router = useTRouter();
  return useMemo(
    () => ({
      push: (href: string, _opts?: { scroll?: boolean }) => router.history.push(href),
      replace: (href: string) => router.history.replace(href),
      back: () => router.history.back(),
    }),
    [router],
  );
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
};

export default function Link({ href, children, ...rest }: LinkProps) {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <TLink to={href as never} {...(rest as object)}>
      {children}
    </TLink>
  );
}
