import { Platform } from 'react-native';

/**
 * Platform entry: native uses Stripe Payment Sheet; web throws (hosted checkout elsewhere).
 * Metro may still resolve `.web` / `.native` for duplicates — this file satisfies TypeScript `import '@/hooks/useWalletPaymentSheet'`.
 */
const impl =
  Platform.OS === 'web'
    ? require('./useWalletPaymentSheet.web')
    : require('./useWalletPaymentSheet.native');

export const useWalletPaymentSheet: typeof import('./useWalletPaymentSheet.native').useWalletPaymentSheet =
  impl.useWalletPaymentSheet;
