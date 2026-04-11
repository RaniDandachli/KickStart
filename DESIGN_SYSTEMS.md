# RuniT Arcade Design System Guide

**React Native (Expo) implementation:** `lib/runitArcadeTheme.ts`, Orbitron in `app/_layout.tsx`, Arcade UI under `components/arcade/`. Short RN reference: **`DESIGN_SYSTEM.md`**.

Use this guide when making ANY changes to the RuniT Arcade app to maintain consistent 80s retro futuristic styling.

## Color Palette (Neon Theme)

All colors are defined in `/src/styles/theme.css`. Always use these CSS variables:

- **Primary (Neon Pink)**: `#ff006e` - Main CTAs, borders, primary actions
- **Secondary (Neon Cyan)**: `#00f0ff` - Secondary actions, highlights, links
- **Accent (Neon Purple)**: `#9d4edd` - Accents, gradients, special elements
- **Yellow**: `#ffbe0b` - Credits, gold elements, warnings
- **Green**: `#39ff14` - Success states, live indicators, positive actions
- **Orange**: `#ff5400` - Destructive actions, hot/trending badges

### Background Colors
- **Main BG**: `#0a0e27` (deep dark blue)
- **Card BG**: `#1a1f3a` (slightly lighter)
- **Muted BG**: `#2a2f4a` (tertiary surface)

## Typography

### Fonts (defined in `/src/styles/fonts.css`)
1. **Press Start 2P** (`var(--font-arcade)`)
   - Use for: Main titles, logo, major headings
   - Example: `style={{ fontFamily: 'var(--font-arcade)' }}`

2. **Orbitron** (`var(--font-retro)` or `font-[Orbitron]`)
   - Use for: All body text, buttons, labels, stats
   - Example: `className="font-[Orbitron]"`

## Key Visual Patterns

### 1. Neon Glow Effects
Always add glow to important elements:
```tsx
// Text glow
<span className="text-[#ff006e] drop-shadow-[0_0_10px_#ff006e]">GLOWING TEXT</span>

// Button glow on hover
<button className="hover:shadow-[0_0_15px_rgba(255,0,110,0.5)]">BUTTON</button>

// Box glow
<div className="shadow-[0_0_20px_rgba(255,0,110,0.4)]">CARD</div>
```

### 2. Gradient Borders
Use gradient wrappers for special cards:
```tsx
<div className="bg-gradient-to-r from-[#ff006e] to-[#9d4edd] p-[2px] rounded-lg">
  <div className="bg-[#0a0e27] p-4 rounded-lg">
    {/* Content */}
  </div>
</div>
```

### 3. Standard Borders
Regular borders should use neon pink with transparency:
```tsx
<div className="border border-[#ff006e]/30">
```

Hover states:
```tsx
<div className="border border-[#ff006e]/20 hover:border-[#00f0ff]/50">
```

### 4. Gradient Backgrounds
Primary buttons and CTAs:
```tsx
// Pink to purple
<button className="bg-gradient-to-r from-[#ff006e] to-[#9d4edd]">

// Pink to orange (hot/urgent)
<button className="bg-gradient-to-r from-[#ff006e] to-[#ff5400]">

// Cyan to purple (secondary)
<button className="bg-gradient-to-r from-[#00f0ff] to-[#9d4edd]">
```

### 5. Live/Active Indicators
```tsx
<div className="flex items-center gap-1 text-[#39ff14]">
  <div className="w-2 h-2 bg-[#39ff14] rounded-full animate-pulse shadow-[0_0_10px_#39ff14]"></div>
  <span>LIVE</span>
</div>
```

### 6. Badge Styling
```tsx
// Hot/Popular badge
<div className="px-2 py-1 bg-[#ff006e]/20 border border-[#ff006e]/50 rounded-full">
  <span className="text-xs font-[Orbitron] text-[#ff006e]">HOT</span>
</div>

// Success badge
<div className="px-2 py-1 bg-[#39ff14]/20 border border-[#39ff14]/50 rounded-full">
  <span className="text-xs font-[Orbitron] text-[#39ff14]">WIN</span>
</div>
```

### 7. Card Pattern
Standard card structure:
```tsx
<div className="bg-[#1a1f3a] rounded-lg p-4 border border-[#ff006e]/20 hover:border-[#00f0ff]/50 transition-all">
  {/* Content */}
</div>
```

### 8. Image Overlays
```tsx
<div className="relative">
  <ImageWithFallback src={image} />
  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
</div>
```

## Component Patterns

### Buttons
```tsx
// Primary CTA
<button className="px-4 py-2 bg-gradient-to-r from-[#ff006e] to-[#9d4edd] rounded font-[Orbitron] font-bold hover:shadow-[0_0_15px_rgba(255,0,110,0.5)] transition-all">
  PLAY NOW
</button>

// Secondary
<button className="px-4 py-2 bg-gradient-to-r from-[#00f0ff] to-[#9d4edd] rounded font-[Orbitron] font-bold hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-all">
  ACTION
</button>
```

### Icons
- Always use Lucide React icons
- Icon colors should match the theme: `#ff006e`, `#00f0ff`, `#9d4edd`, `#ffbe0b`, `#39ff14`
- Size: typically `w-4 h-4` or `w-5 h-5`

### Stats Display
```tsx
<div className="text-center">
  <div className="flex items-center justify-center mb-1">
    <Icon className="w-4 h-4 text-[#ffbe0b]" />
  </div>
  <div className="font-[Orbitron] font-bold text-lg text-[#00f0ff]">VALUE</div>
  <div className="text-[10px] text-gray-400 font-[Orbitron]">LABEL</div>
</div>
```

## Animation & Transitions

Always add smooth transitions:
```tsx
className="transition-all hover:scale-105"
```

For pulsing elements (live indicators):
```tsx
className="animate-pulse"
```

## Spacing & Layout

- Container padding: `px-4`
- Section spacing: `mb-6`
- Card padding: `p-3` or `p-4`
- Gap between elements: `gap-2`, `gap-3`, or `gap-4`

## DO's and DON'Ts

### ✅ DO:
- Use neon colors (#ff006e, #00f0ff, #9d4edd, #ffbe0b, #39ff14)
- Add glow effects to important elements
- Use Orbitron font for all text except major titles
- Use Press Start 2P for logos and main headings
- Add gradient borders to special cards
- Include hover states with glow effects
- Use rounded corners (rounded-lg, rounded-full)

### ❌ DON'T:
- Use standard gray/black/white without neon accents
- Forget to add glow effects on CTAs
- Mix other font families
- Use flat colors without gradients for important actions
- Skip transition animations
- Use sharp corners (except for retro pixel elements)
- Ignore the established color palette

## Quick Copy-Paste Examples

### Title with Glow
```tsx
<h1 className="text-2xl" style={{ fontFamily: 'var(--font-arcade)' }}>
  <span className="text-[#ff006e] drop-shadow-[0_0_10px_#ff006e]">RuniT</span>
  <span className="text-[#00f0ff] drop-shadow-[0_0_10px_#00f0ff]"> ARCADE</span>
</h1>
```

### Game Card
```tsx
<div className="bg-[#1a1f3a] rounded-lg overflow-hidden border border-[#ff006e]/20 hover:border-[#00f0ff]/50 transition-all group">
  <div className="flex gap-3 p-3">
    {/* Content */}
  </div>
</div>
```

### Stat Badge
```tsx
<div className="flex items-center gap-2 text-[#ffbe0b]">
  <Trophy className="w-4 h-4" />
  <span className="font-[Orbitron] font-bold">500 CR</span>
</div>
```

---

**When asking Cursor to make changes, reference this file:**
"Follow the design patterns in /DESIGN_SYSTEM.md to maintain the 80s retro arcade aesthetic"
E4 