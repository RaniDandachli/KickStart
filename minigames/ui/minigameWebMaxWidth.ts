import { Platform } from 'react-native';

/** Default max width (px) for minigame playfields on desktop web. */
export const WEB_MINIGAME_STAGE_MAX_WIDTH = 900;

/** Use a wider stage on web; keep compact `phoneMax` on iOS/Android. */
export function minigameStageMaxWidth(phoneMax: number): number {
  return Platform.OS === 'web' ? WEB_MINIGAME_STAGE_MAX_WIDTH : phoneMax;
}
