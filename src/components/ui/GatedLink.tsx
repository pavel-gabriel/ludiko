import { useState, type ReactNode } from 'react'
import ParentalGate from '@/components/ui/ParentalGate'

interface GatedLinkProps {
  /** https:// or mailto: URL that leaves the app */
  href: string
  className?: string
  children: ReactNode
}

/**
 * Every link that leaves the app (web pages, mailto) goes through here so a parental gate
 * is shown first (Kids Category rules). Renders a real <a> for semantics and long-press copy.
 */
export default function GatedLink({ href, className, children }: GatedLinkProps) {
  const [open, setOpen] = useState(false)

  const go = () => {
    setOpen(false)
    if (href.startsWith('mailto:')) window.location.href = href
    else window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <a
        href={href}
        rel="noopener noreferrer"
        className={className}
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        {children}
      </a>
      {open && <ParentalGate onPass={go} onCancel={() => setOpen(false)} />}
    </>
  )
}
