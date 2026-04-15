import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { LEGAL_LAST_UPDATED, PRIVACY_SECTIONS } from '@/lib/inAppLegalCopy';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen heading="Privacy policy" lastUpdated={LEGAL_LAST_UPDATED} sections={PRIVACY_SECTIONS} />
  );
}
