import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

type IconProps = {
  size?: number;
};

/**
 * Tap Dash — neon orb + vertical gate mark (vector, no raster).
 */
export function TapDashGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="tdOrb" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ADE80" />
            <Stop offset="45%" stopColor="#22D3EE" />
            <Stop offset="100%" stopColor="#38BDF8" />
          </SvgLinearGradient>
          <SvgLinearGradient id="tdGate" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#22D3EE" />
            <Stop offset="50%" stopColor="#A78BFA" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </SvgLinearGradient>
          <SvgLinearGradient id="tdGlow" x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#34D399" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#22D3EE" stopOpacity="0.15" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="#0B1220" />
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="url(#tdGlow)" opacity={0.6} />
        {/* Gate pillars */}
        <Rect x="30" y="8" width="6" height="14" rx="2" fill="url(#tdGate)" opacity={0.95} />
        <Rect x="30" y="26" width="6" height="14" rx="2" fill="url(#tdGate)" opacity={0.95} />
        {/* Orb */}
        <Circle cx="17" cy="24" r="9" fill="url(#tdOrb)" />
        <Circle cx="14" cy="21" r="3" fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </View>
  );
}

/**
 * Tile Clash — interlocking tiles / grid clash mark.
 */
export function TileClashGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="tcA" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#4F46E5" />
          </SvgLinearGradient>
          <SvgLinearGradient id="tcB" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F472B6" />
            <Stop offset="100%" stopColor="#BE185D" />
          </SvgLinearGradient>
          <SvgLinearGradient id="tcC" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#34D399" />
            <Stop offset="100%" stopColor="#059669" />
          </SvgLinearGradient>
          <SvgLinearGradient id="tcD" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor="#D97706" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="#0F172A" />
        <Rect x="9" y="10" width="14" height="14" rx="3" fill="url(#tcA)" />
        <Rect x="25" y="10" width="14" height="14" rx="3" fill="url(#tcB)" />
        <Rect x="9" y="26" width="14" height="14" rx="3" fill="url(#tcC)" />
        <Rect x="25" y="26" width="14" height="14" rx="3" fill="url(#tcD)" />
        <Path
          d="M 23 24 L 26 27 L 31 21"
          stroke="#F8FAFC"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.9}
        />
      </Svg>
    </View>
  );
}

/**
 * Dash Duel — forward shard runner + neon track hint.
 */
/**
 * Neon Ball Run — synthwave tunnel + magenta sphere.
 */
export function BallRunGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="brPath" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.95" />
          </SvgLinearGradient>
          <SvgLinearGradient id="brBall" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#f0abfc" />
            <Stop offset="55%" stopColor="#e879f9" />
            <Stop offset="100%" stopColor="#a21caf" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="#0f0518" />
        <Path d="M 10 14 L 24 8 L 38 14 L 38 38 L 10 38 Z" fill="url(#brPath)" opacity={0.9} />
        <Path
          d="M 14 18 L 24 14 L 34 18"
          stroke="rgba(34,211,238,0.5)"
          strokeWidth="1"
          fill="none"
        />
        <Circle cx="24" cy="30" r="9" fill="url(#brBall)" />
        <Circle cx="21" cy="27" r="3" fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </View>
  );
}

/** Turbo Arena — neon car + ball hint (side‑view). */
export function TurboArenaGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="taBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#020617" />
            <Stop offset="100%" stopColor="#0f172a" />
          </SvgLinearGradient>
          <SvgLinearGradient id="taBall" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#bae6fd" />
            <Stop offset="100%" stopColor="#0284c7" />
          </SvgLinearGradient>
          <SvgLinearGradient id="taCar" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#fb923c" />
            <Stop offset="100%" stopColor="#ea580c" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="url(#taBg)" />
        <Ellipse cx="24" cy="30" rx="14" ry="5" fill="rgba(34,211,238,0.15)" />
        <Circle cx="28" cy="22" r="7" fill="url(#taBall)" />
        <Path
          d="M 10 32 L 22 28 L 34 30 L 36 34 L 8 36 Z"
          fill="url(#taCar)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.8"
        />
        <Circle cx="14" cy="35" r="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
        <Circle cx="30" cy="35" r="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
      </Svg>
    </View>
  );
}

/** Neon Pocket — top-down pool table + cue ball (generic game, not a trademarked title). */
export function NeonPoolGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="npFelt" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#047857" />
            <Stop offset="100%" stopColor="#022c22" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="#1c1917" />
        <Rect x="8" y="12" width="32" height="24" rx="3" fill="url(#npFelt)" />
        <Circle cx="16" cy="24" r="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
        <Circle cx="30" cy="22" r="3.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.6" />
        <Circle cx="28" cy="28" r="3.5" fill="#1e293b" stroke="#f8fafc" strokeWidth="0.6" />
        <Circle cx="14" cy="18" r="2" fill="#0a0a0a" />
        <Circle cx="34" cy="30" r="2" fill="#0a0a0a" />
      </Svg>
    </View>
  );
}

export function DashDuelGameIcon({ size = 40 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <SvgLinearGradient id="ddBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#020617" />
            <Stop offset="100%" stopColor="#0f172a" />
          </SvgLinearGradient>
          <SvgLinearGradient id="ddShard" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ADE80" />
            <Stop offset="50%" stopColor="#22D3EE" />
            <Stop offset="100%" stopColor="#A78BFA" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="10" fill="url(#ddBg)" />
        <Path
          d="M 14 30 L 24 12 L 34 30 Z"
          fill="url(#ddShard)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        />
        <Rect x="10" y="34" width="28" height="3" rx="1" fill="rgba(52,211,153,0.45)" />
        <Rect x="12" y="36" width="6" height="2" rx="0.5" fill="rgba(34,211,238,0.5)" />
        <Rect x="22" y="36" width="6" height="2" rx="0.5" fill="rgba(34,211,238,0.5)" />
        <Rect x="30" y="36" width="6" height="2" rx="0.5" fill="rgba(34,211,238,0.5)" />
      </Svg>
    </View>
  );
}
