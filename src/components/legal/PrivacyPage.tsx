import { PRIVACY } from '@/legal/privacy'
import LegalPage from './LegalPage'

/** /privacy: privacy policy (DRAFT pending lawyer review), text in src/legal/privacy.ts */
export default function PrivacyPage() {
  return <LegalPage kind="privacy" texts={PRIVACY} />
}
