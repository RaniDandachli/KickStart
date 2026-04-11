/**
 * SVG glyphs for web where Ionicon font sometimes fails to paint (static export / CDN).
 * viewBox 0 0 24 24 — stroke-based icons matching app tone.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

type GProps = { size: number; color: string };

function Box({ size, children }: { size: number; children: ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

export function WebGlyphHome({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 013 20v-9.5z"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

export function WebGlyphTrophy({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 4h12v3a4 4 0 01-4 4h-4a4 4 0 01-4-4V4zM8 4V3a1 1 0 011-1h6a1 1 0 011 1v1M9 21h6M12 17v4"
          stroke={color}
          strokeWidth={1.65}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M7 14h10v3a2 2 0 01-2 2H9a2 2 0 01-2-2v-3z" stroke={color} strokeWidth={1.65} />
      </Svg>
    </Box>
  );
}

export function WebGlyphGameController({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.5 9h11a4 4 0 014 4v1a3 3 0 01-3 3h-1.5a3 3 0 01-2.8-2H10.3a3 3 0 01-2.8 2H6a3 3 0 01-3-3v-1a4 4 0 014-4z"
          stroke={color}
          strokeWidth={1.65}
          strokeLinejoin="round"
        />
        <Circle cx={9} cy={13} r={1.1} fill={color} />
        <Circle cx={15} cy={13} r={1.1} fill={color} />
        <Path d="M11 11.5h2M12 10.5v2" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

export function WebGlyphGift({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 8V21M4 8h16v4H4V8z" stroke={color} strokeWidth={1.65} strokeLinejoin="round" />
        <Path
          d="M12 8H7.5a2.5 2.5 0 010-5C11 3 12 8 12 8zm0 0h4.5a2.5 2.5 0 000-5C13 3 12 8 12 8z"
          stroke={color}
          strokeWidth={1.65}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

export function WebGlyphPerson({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={1.65} />
        <Path d="M5 20v-1a5 5 0 015-5h4a5 5 0 015 5v1" stroke={color} strokeWidth={1.65} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

export function WebGlyphFlash({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M13 2L4 14h7l-1 8 10-12h-7l0-8z"
          fill={color}
        />
      </Svg>
    </Box>
  );
}

export function WebGlyphWallet({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={6} width={18} height={12} rx={2} stroke={color} strokeWidth={1.65} />
        <Path d="M3 10h18M16 14h2" stroke={color} strokeWidth={1.65} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

export function WebGlyphPeople({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={8} r={2.5} stroke={color} strokeWidth={1.5} />
        <Path d="M4 18v-1a4 4 0 014-4h2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={17} cy={9} r={2.2} stroke={color} strokeWidth={1.5} />
        <Path d="M14 18v-1a3 3 0 013-3h1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

export function WebGlyphCash({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={1.65} />
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
        <Path d="M12 10v4M10.5 12h3" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

export function WebGlyphFlame({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 22c4-2 6-5.5 6-9a6 6 0 00-6-6 6 6 0 00-6 6c0 3.5 2 7 6 9z"
          stroke={color}
          strokeWidth={1.65}
          strokeLinejoin="round"
        />
        <Path d="M12 16a3 3 0 01-2-5.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphChevronBack({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 18l-6-6 6-6"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

/** Tier / misc outline icons (names match MATCH_ENTRY_TIERS + common) */
export function WebGlyphByIonName({ name, size, color }: { name: string; size: number; color: string }) {
  switch (name) {
    case 'flash-outline':
    case 'flash':
      return <WebGlyphFlashOutline size={size} color={color} />;
    case 'flame-outline':
    case 'flame':
      return <WebGlyphFlame size={size} color={color} />;
    case 'trending-up-outline':
      return <WebGlyphTrending size={size} color={color} />;
    case 'ribbon-outline':
      return <WebGlyphRibbon size={size} color={color} />;
    case 'diamond-outline':
      return <WebGlyphDiamond size={size} color={color} />;
    case 'star-outline':
      return <WebGlyphStar size={size} color={color} />;
    case 'star':
      return <WebGlyphStarFilled size={size} color={color} />;
    case 'wallet-outline':
    case 'wallet':
      return <WebGlyphWallet size={size} color={color} />;
    case 'trophy-outline':
      return <WebGlyphTrophyOutline size={size} color={color} />;
    case 'trophy':
      return <WebGlyphTrophy size={size} color={color} />;
    case 'people-outline':
      return <WebGlyphPeopleOutline size={size} color={color} />;
    case 'people':
      return <WebGlyphPeople size={size} color={color} />;
    case 'cash-outline':
      return <WebGlyphCash size={size} color={color} />;
    case 'home':
      return <WebGlyphHome size={size} color={color} />;
    case 'game-controller-outline':
      return <WebGlyphGameControllerOutline size={size} color={color} />;
    case 'game-controller':
      return <WebGlyphGameController size={size} color={color} />;
    case 'gift':
      return <WebGlyphGift size={size} color={color} />;
    case 'person':
      return <WebGlyphPerson size={size} color={color} />;
    case 'camera':
      return <WebGlyphCamera size={size} color={color} />;
    case 'arrow-forward':
      return <WebGlyphArrowForward size={size} color={color} />;
    case 'arrow-down':
      return <WebGlyphArrowDown size={size} color={color} />;
    case 'arrow-down-circle-outline':
      return <WebGlyphArrowDownCircleOutline size={size} color={color} />;
    case 'log-in-outline':
      return <WebGlyphLogInOutline size={size} color={color} />;
    case 'chevron-back':
      return <WebGlyphChevronBack size={size} color={color} />;
    case 'chevron-forward':
      return <WebGlyphChevronForward size={size} color={color} />;
    case 'chevron-up':
      return <WebGlyphChevronUp size={size} color={color} />;
    case 'chevron-down':
      return <WebGlyphChevronDown size={size} color={color} />;
    case 'home-outline':
      return <WebGlyphHome size={size} color={color} />;
    case 'gift-outline':
      return <WebGlyphGift size={size} color={color} />;
    case 'information-circle-outline':
      return <WebGlyphInfoCircleOutline size={size} color={color} />;
    case 'information-circle':
      return <WebGlyphInformationCircle size={size} color={color} />;
    case 'checkmark-circle':
      return <WebGlyphCheckmarkCircle size={size} color={color} />;
    case 'cube-outline':
      return <WebGlyphCubeOutline size={size} color={color} />;
    case 'mail-outline':
      return <WebGlyphMailOutline size={size} color={color} />;
    case 'card-outline':
      return <WebGlyphCardOutline size={size} color={color} />;
    case 'folder-open-outline':
      return <WebGlyphFolderOpenOutline size={size} color={color} />;
    case 'ticket-outline':
      return <WebGlyphTicketOutline size={size} color={color} />;
    case 'cart-outline':
      return <WebGlyphCartOutline size={size} color={color} />;
    case 'link-outline':
      return <WebGlyphLinkOutline size={size} color={color} />;
    case 'close':
      return <WebGlyphClose size={size} color={color} />;
    case 'open-outline':
      return <WebGlyphOpenOutline size={size} color={color} />;
    case 'cloud-offline-outline':
      return <WebGlyphCloudOfflineOutline size={size} color={color} />;
    case 'school-outline':
      return <WebGlyphSchoolOutline size={size} color={color} />;
    case 'add-circle-outline':
      return <WebGlyphAddCircleOutline size={size} color={color} />;
    case 'git-compare-outline':
      return <WebGlyphGitCompareOutline size={size} color={color} />;
    case 'git-merge-outline':
      return <WebGlyphGitMergeOutline size={size} color={color} />;
    default:
      return <WebGlyphFlash size={size} color={color} />;
  }
}

function WebGlyphInfoCircleOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.75} />
        <Path
          d="M12 16v-5M12 8h.01"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphArrowForward({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12h14M13 6l6 6-6 6"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphLogInOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphFlashOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
          stroke={color}
          strokeWidth={1.65}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphTrending({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Polyline points="3 17 9 11 13 15 21 7" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="14 7 21 7 21 14" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphRibbon({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphDiamond({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3l8 8-8 10-8-10 8-8z" stroke={color} strokeWidth={1.65} strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphStar({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2l2.9 6.9L22 10l-5.5 4.4L18.2 22 12 18.3 5.8 22l1.7-7.6L2 10l7.1-1.1L12 2z"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphStarFilled({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2l2.9 6.9L22 10l-5.5 4.4L18.2 22 12 18.3 5.8 22l1.7-7.6L2 10l7.1-1.1L12 2z"
          fill={color}
        />
      </Svg>
    </Box>
  );
}

function WebGlyphChevronForward({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphChevronUp({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphChevronDown({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphCubeOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphMailOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={1.65} />
        <Path d="M3 7l9 6 9-6" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphCardOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={2} y={5} width={20} height={14} rx={2} stroke={color} strokeWidth={1.65} />
        <Path d="M2 10h20" stroke={color} strokeWidth={1.65} />
      </Svg>
    </Box>
  );
}

function WebGlyphFolderOpenOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9V6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1M4 9h16l-2 9H6L4 9z"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphTicketOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9a2 2 0 012-2h12a2 2 0 012 2v1.5a1.5 1.5 0 010 3V15a2 2 0 01-2 2H6a2 2 0 01-2-2v-1.5a1.5 1.5 0 010-3V9zM12 7v10"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphTrophyOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 4h12v3a4 4 0 01-4 4h-4a4 4 0 01-4-4V4zM8 4V3a1 1 0 011-1h6a1 1 0 011 1v1M9 21h6M12 17v4M7 14h10v3a2 2 0 01-2 2H9a2 2 0 01-2-2v-3z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphCartOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={20} r={1.5} fill={color} />
        <Circle cx={18} cy={20} r={1.5} fill={color} />
        <Path
          d="M3 3h2l1.5 12h13l2-9H6"
          stroke={color}
          strokeWidth={1.65}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphInformationCircle({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} fill={color} />
        <Path d="M12 16v-5M12 8h.01" stroke="rgba(15,23,42,0.92)" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphCheckmarkCircle({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.75} />
        <Path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphLinkOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M10 13a5 5 0 01-.7 7.1 5 5 0 01-7-7 5 5 0 017.1-.7M14 11a5 5 0 01.7-7.1 5 5 0 017 7 5 5 0 01-7.1.7M8 16l8-8"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphClose({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphOpenOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M18 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
          stroke={color}
          strokeWidth={1.65}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphCloudOfflineOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M18 10h1.5a2.5 2.5 0 010 5H16M6 18h.5a5 5 0 01-1-9.9 3.5 3.5 0 016.3-1.8"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphSchoolOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 10l-10-5-10 5 10 5 10-5z" stroke={color} strokeWidth={1.65} strokeLinejoin="round" />
        <Path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" stroke={color} strokeWidth={1.65} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphPeopleOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={7} r={3} stroke={color} strokeWidth={1.5} />
        <Path d="M3 21v-2a4 4 0 014-4h2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={17} cy={8} r={2.8} stroke={color} strokeWidth={1.5} />
        <Path d="M13 21v-1a4 4 0 014-4h1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphCamera({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 8h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2v-9a2 2 0 012-2z"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={14} r={3.5} stroke={color} strokeWidth={1.5} />
      </Svg>
    </Box>
  );
}

function WebGlyphAddCircleOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.75} />
        <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphGameControllerOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.5 9h11a4 4 0 014 4v1a3 3 0 01-3 3h-1.5a3 3 0 01-2.8-2H10.3a3 3 0 01-2.8 2H6a3 3 0 01-3-3v-1a4 4 0 014-4z"
          stroke={color}
          strokeWidth={1.65}
          strokeLinejoin="round"
        />
        <Circle cx={9} cy={13} r={1.1} stroke={color} strokeWidth={1.2} />
        <Circle cx={15} cy={13} r={1.1} stroke={color} strokeWidth={1.2} />
        <Path d="M11 11.5h2M12 10.5v2" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphArrowDownCircleOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.75} />
        <Path d="M12 8v8m0 0l-3-3m3 3l3-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphArrowDown({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Box>
  );
}

function WebGlyphGitCompareOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={6} cy={6} r={2.5} stroke={color} strokeWidth={1.5} />
        <Circle cx={18} cy={18} r={2.5} stroke={color} strokeWidth={1.5} />
        <Path
          d="M8.5 7.5l7 9M15.5 16.5l-7-9M18 8v4h-4M6 16v-4h4"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}

function WebGlyphGitMergeOutline({ size, color }: GProps) {
  return (
    <Box size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={18} cy={6} r={2.5} stroke={color} strokeWidth={1.5} />
        <Circle cx={6} cy={6} r={2.5} stroke={color} strokeWidth={1.5} />
        <Circle cx={12} cy={18} r={2.5} stroke={color} strokeWidth={1.5} />
        <Path
          d="M6 8.5v2a4 4 0 004 4h2a4 4 0 004-4v-2M12 14.5V18"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Box>
  );
}
