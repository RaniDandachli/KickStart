import { useEffect } from 'react';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import {
  emptyShippingAddress,
  isShippingAddressComplete,
  parseShippingAddress,
  shippingAddressToJson,
  type ShippingAddress,
} from '@/lib/shippingAddress';
import { updateProfileFields } from '@/services/api/profiles';
import { useAuthStore } from '@/store/authStore';
import { useDemoShippingAddressStore } from '@/store/demoShippingAddressStore';

/**
 * Shipping address for physical prizes: profile JSON when backend is on, else persisted demo store.
 */
export function useShippingAddress() {
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const demoAddr = useDemoShippingAddressStore((s) => s.address);
  const hydrate = useDemoShippingAddressStore((s) => s.hydrate);
  const setDemo = useDemoShippingAddressStore((s) => s.setAddress);

  useEffect(() => {
    if (!ENABLE_BACKEND) void hydrate();
  }, [hydrate]);

  const fromProfile = profileQ.data?.shipping_address
    ? parseShippingAddress(profileQ.data.shipping_address)
    : emptyShippingAddress();

  const address = ENABLE_BACKEND ? fromProfile : demoAddr;
  const complete = isShippingAddressComplete(address);

  const save = async (next: ShippingAddress) => {
    const payload = shippingAddressToJson(next);
    if (!ENABLE_BACKEND) {
      setDemo(next);
      return;
    }
    if (!uid) throw new Error('Not signed in');
    await updateProfileFields(uid, { shipping_address: payload });
  };

  return {
    address,
    complete,
    save,
    isLoadingProfile: ENABLE_BACKEND && !!uid && profileQ.isLoading,
  };
}
