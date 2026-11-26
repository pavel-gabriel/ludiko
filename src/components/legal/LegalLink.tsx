import type { ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { PRIVACY_PATH, TERMS_PATH } from '@/legal/types'

interface LegalLinkProps {
  to: 'privacy' | 'terms'
  className?: string
  children: ReactNode
}

/**
 * One-line link to /privacy or /terms for consent texts and footers. Renders a router `Link` inside the app
 * and a plain anchor where no router exists (isolated component tests), so it is safe to drop in anywhere.
 */
export default function LegalLink({ to, className, children }: LegalLinkProps) {
  const inRouter = useInRouterContext()
  const path = to === 'privacy' ? PRIVACY_PATH : TERMS_PATH
  const cls = className ?? 'font-bold underline'
  if (inRouter) {
    return (
      <Link to={path} className={cls} data-testid={`legal-link-${to}`}>
        {children}
      </Link>
    )
  }
  return (
    <a href={path} className={cls} data-testid={`legal-link-${to}`}>
      {children}
    </a>
  )
}
