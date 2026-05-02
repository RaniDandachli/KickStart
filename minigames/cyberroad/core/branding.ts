/** Public-facing identity for Cyber Road (RunITARCADE). Import from UI / share only. */
export const CYBER_ROAD_GAME_TITLE = "Cyber Road";
export const CYBER_ROAD_STUDIO = "RunITARCADE";
/** Primary link for share sheets (site / store landing). */
export const CYBER_ROAD_SHARE_URL = "https://runitarcade.app";

/** AsyncStorage namespace — bump suffix if you change persisted shape. */
export const CYBER_ROAD_STORAGE_KEY = "@RunITARCADE/CyberRoad/v1";

export function cyberRoadShareBody(characterName?: string): string {
  if (characterName) {
    return `${characterName} · ${CYBER_ROAD_GAME_TITLE} · ${CYBER_ROAD_STUDIO}\n${CYBER_ROAD_SHARE_URL}`;
  }
  return `${CYBER_ROAD_GAME_TITLE} · ${CYBER_ROAD_STUDIO}\n${CYBER_ROAD_SHARE_URL}`;
}
