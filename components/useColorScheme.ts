import { useColorScheme as useColorSchemeCore } from 'react-native';

/** Resolved theme for UI (`null` from RN → light). */
export const useColorScheme = (): 'light' | 'dark' => {
  const coreScheme = useColorSchemeCore();
  return coreScheme === 'dark' ? 'dark' : 'light';
};
