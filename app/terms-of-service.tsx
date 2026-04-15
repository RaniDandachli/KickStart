import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS } from '@/lib/inAppLegalCopy';

export default function TermsOfServiceScreen() {
  return (
    <LegalDocumentScreen heading="Terms of service" lastUpdated={LEGAL_LAST_UPDATED} sections={TERMS_SECTIONS} />
  );
}
