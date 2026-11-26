import { TERMS } from '@/legal/terms'
import LegalPage from './LegalPage'

/** /terms: terms of use (DRAFT pending lawyer review), text in src/legal/terms.ts */
export default function TermsPage() {
  return <LegalPage kind="terms" texts={TERMS} />
}
