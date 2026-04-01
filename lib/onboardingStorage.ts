import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_WELCOME = '@kickclash/has_seen_welcome_v1';
const HAS_COMPLETED_TAB_TOUR = '@kickclash/has_completed_tab_tour_v1';

export async function getHasSeenWelcome(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HAS_SEEN_WELCOME);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setHasSeenWelcome(): Promise<void> {
  await AsyncStorage.setItem(HAS_SEEN_WELCOME, '1');
}

export async function getHasCompletedTabTour(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HAS_COMPLETED_TAB_TOUR);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setHasCompletedTabTour(): Promise<void> {
  await AsyncStorage.setItem(HAS_COMPLETED_TAB_TOUR, '1');
}
