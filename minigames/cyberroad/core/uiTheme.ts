/**
 * Visual identity for Cyber Road — distinct from template/sample lane-runner UI.
 * Dark violet base, cyan + magenta neon accents (RunIT arcade lane).
 */
export const CyberRoadUi = {
  bgRoot: "#070510",
  bgElevated: "#0c0818",
  bgPanel: "rgba(18, 12, 36, 0.88)",
  bgDock: "rgba(7, 5, 16, 0.94)",
  accentCyan: "#2ee9e6",
  accentMagenta: "#d946ef",
  accentAmber: "#fbbf24",
  stroke: "rgba(46, 233, 230, 0.45)",
  strokeMuted: "rgba(148, 163, 184, 0.25)",
  textPrimary: "#f1f5f9",
  textMuted: "#94a3b8",
  /** Pause / overlay scrim */
  scrim: "rgba(7, 5, 16, 0.88)",
  radiusPanel: 16,
  radiusChip: 12,
  radiusDock: 20,
} as const;

export const CYBER_TAGLINE = "Neon lanes · endless run";
