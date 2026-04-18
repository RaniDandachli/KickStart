import { Platform } from 'react-native';

/** Web viewports at or above this width use the dedicated laptop home layout (see `HomeScreenWebLaptop`). */
export const HOME_WEB_LAPTOP_MIN_WIDTH = 1024;

export function isWebLaptopViewport(width: number): boolean {
  return Platform.OS === 'web' && width >= HOME_WEB_LAPTOP_MIN_WIDTH;
}
