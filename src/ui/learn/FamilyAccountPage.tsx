import { useTranslation } from 'react-i18next'
import FamilyAccountCard from '@/components/family/FamilyAccountCard'
import LearnShell from './LearnShell'

/**
 * /learn/account: the parent account without needing a child profile, so a parent on a brand-new device can
 * sign in and import the children (the same card also lives on /learn/parent).
 */
export default function FamilyAccountPage() {
  const { t } = useTranslation()
  return (
    <LearnShell title={t('family.title')} backTo="/profiles" backLabel={t('family.back')}>
      <FamilyAccountCard showUnavailable />
    </LearnShell>
  )
}
