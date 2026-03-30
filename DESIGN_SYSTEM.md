# Run it — Arcade design system (React Native)

Extended patterns (Tailwind-style snippets, DO/DON’Ts): **`DESIGN_SYSTEMS.md`**.

Reference: cyberpunk arcade floor — neon on deep violet/black, gradient borders, soft outer glow.

## Brand colors

| Token | Hex | Usage |
|--------|-----|--------|
| Neon pink | `#ff006e` | Primary CTAs, active tab, key headlines |
| Neon cyan | `#00f0ff` | Secondary energy, Solo / info accents |
| Neon purple | `#9d4edd` | Depth, borders mixed with pink |

## Typography

- **Display / section titles:** Orbitron (Black 900 / Bold 700). Tight letter-spacing on logos.
- **Body:** System default or existing app sans; keep readable on dark backgrounds.

## Glow (NativeWind / RN)

- **Text glow (pink):** `text-shadow` equivalent: `textShadowColor: rgba(255,0,110,0.85)`, `textShadowOffset: {0,0}`, `textShadowRadius: 10` (maps to `drop-shadow` ~ `0 0 10px #ff006e`).
- **Interactive glow (press / hover):** `shadowColor: rgba(255,0,110,0.5)`, `shadowRadius: 15`, `shadowOffset: {0,0}` — use on `Pressable` when pressed for “hover” feedback.

## Components

### Credits badge

Horizontal gradient **pink → purple**, pill or rounded rect, gold coin icon, uppercase label (e.g. `12,456 PRIZE CREDITS`).

### Stat chips (Wins / Rank / Streak)

Small cards with **thin gradient border** (cyan / purple / pink per column), dark fill, icon + label + value.

### Quick play (1v1 / Solo)

Large horizontal tiles: **1v1** = pink → dark fade + lightning; **Solo** = cyan → dark + star. Outer soft glow, rounded corners.

### Game row (“Hot games”)

Dark semi-transparent panel, optional flame/status chip, **Play** = pink → purple gradient pill.

### Buttons

Primary: pink → purple linear gradient, white label, 2px light border, elevation + pink shadow.

---

Code: `lib/runitArcadeTheme.ts` exports tokens and shadow presets. Arcade tab uses these in `ArcadeFloor`, `ArcadeBalanceBar`, `ArcadeStatsRow`, `ArcadeQuickMatch`, `ArcadeGameRow`, `ArcadePromoBanner`.
