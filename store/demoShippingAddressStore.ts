import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { emptyShippingAddress, type ShippingAddress } from '@/lib/shippingAddress';

const STORAGE_KEY = '@kickclash/shipping_address_v1';

type State = {
  address: ShippingAddress;
  hydrated: boolean;
  setAddress: (a: ShippingAddress) => void;
  hydrate: () => Promise<void>;
};

export const useDemoShippingAddressStore = create<State>((set, get) => ({
  address: emptyShippingAddress(),
  hydrated: false,
  setAddress: (a) => {
    set({ address: a });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ShippingAddress>;
        set({
          address: { ...emptyShippingAddress(), ...parsed },
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
