import { Platform } from 'react-native';

/** Breakpoint: at or above this width the home uses the full two-column hero + side-by-side panels. Below = compact single column. */
export const HOME_WEB_LAPTOP_MIN_WIDTH = 1024;

export function isWebLaptopViewport(width: number): boolean {
  return Platform.OS === 'web' && width >= HOME_WEB_LAPTOP_MIN_WIDTH;
}
