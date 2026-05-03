import type { ImageSourcePropType } from 'react-native';

/** Internal promo kit — Settings → Marketing (remove before public launch). */

export type HowItWorksSlide = {
  id: string;
  image: ImageSourcePropType;
  kicker: string;
  title: string;
  body: string[];
};

export const HOW_IT_WORKS_SLIDES: HowItWorksSlide[] = [
  {
    id: 'home',
    image: require('@/assets/how-it-works/01-home.png'),
    kicker: 'STEP 1',
    title: 'YOUR ARCADE HUB',
    body: [
      'Run iT Arcade is a neon skill arena — minigames, head-to-head queues, and daily events in one place.',
      'Pick a mode, warm up in practice, or go straight to prize runs when you’re ready.',
    ],
  },
  {
    id: 'games',
    image: require('@/assets/how-it-works/02-minigames.png'),
    kicker: 'STEP 2',
    title: 'PICK A GAME',
    body: [
      'Each title is a short skill challenge — reflex, rhythm, stacker, 3D chase, and more.',
      'Practice is free. Prize runs spend Arcade Credits and can earn redeem tickets.',
    ],
  },
  {
    id: 'match',
    image: require('@/assets/how-it-works/03-queue.png'),
    kicker: 'STEP 3',
    title: 'QUEUE & COMPETE',
    body: [
      'Jump into matchmaking for the game you chose — we pair you for a fair head-to-head.',
      'Higher score wins. Results sync when both players finish.',
    ],
  },
  {
    id: 'wallet',
    image: require('@/assets/how-it-works/04-tap-dash.png'),
    kicker: 'STEP 4',
    title: 'FUND · WIN · REDEEM',
    body: [
      'Add funds for paid contests, grow your wallet, and withdraw through Whop when available.',
      'Arcade Credits and redeem tickets power the prize loop — play sharp, cash out smart.',
    ],
  },
];

export type GamePromoCard = {
  id: string;
  title: string;
  tagline: string;
  bullets: string[];
  /** Real screenshot when we have one; otherwise UI uses gradient + icon. */
  image?: ImageSourcePropType;
  gradient: readonly [string, string, string];
};

export const GAME_PROMO_CARDS: GamePromoCard[] = [
  {
    id: 'tap-dash',
    title: 'Tap Dash',
    tagline: 'Neon reflex lanes',
    bullets: ['Tap the lane before the pulse crosses the line.', 'Chains build score — miss ends the streak.'],
    image: require('@/assets/how-it-works/04-tap-dash.png'),
    gradient: ['#1e1b4b', '#312e81', '#4c1d95'],
  },
  {
    id: 'tile-clash',
    title: 'Tile Clash',
    tagline: 'Match-3 under pressure',
    bullets: ['Swap tiles to clear space and hit target score.', 'Great for screenshot grids — saturated colors pop on Reels.'],
    image: require('@/assets/how-it-works/02-minigames.png'),
    gradient: ['#0f172a', '#1e1b4b', '#5b21b6'],
  },
  {
    id: 'dash-duel',
    title: 'Dash Duel',
    tagline: 'Side-scrolling sprint',
    bullets: ['Dodge obstacles and collect boosts in a short burst run.', 'Easy “watch me clutch” clip for TikTok.'],
    gradient: ['#020617', '#0c4a6e', '#164e63'],
  },
  {
    id: 'ball-run',
    title: 'Neon Ball Run',
    tagline: '3D tunnel survival',
    bullets: ['Steer through rotating color gates — wrong slice ends the run.', 'Best on native (full 3D); use app store CTA in captions.'],
    gradient: ['#1a0b2e', '#4c1d95', '#831843'],
  },
  {
    id: 'neon-dance',
    title: 'Neon Dance',
    tagline: 'Orbit the hoop',
    bullets: ['Spin the chip to pass through the matching color slice.', 'Strong “one more try” loop for Stories.'],
    gradient: ['#050508', '#1e1b4b', '#312e81'],
  },
  {
    id: 'turbo-arena',
    title: 'Turbo Arena',
    tagline: 'Top-down arena duel',
    bullets: ['Outlast the rival in a tight neon arena.', 'Good for split-screen reaction posts.'],
    gradient: ['#020617', '#0c4a6e', '#7c2d12'],
  },
  {
    id: 'stacker',
    title: 'Stacker',
    tagline: 'Timing jackpot tower',
    bullets: ['Drop slabs — perfect stacks climb toward the jackpot zone.', 'Satisfying stack ASMR angle for Shorts.'],
    gradient: ['#0c0a0f', '#1e1b4b', '#831843'],
  },
];

export const DAILY_TOURNAMENT_PROMO = {
  title: 'TOURNAMENT OF THE DAY',
  kicker: 'FREE ENTRY · DAILY RESET',
  bullets: [
    'One run per local day — survive every round of rotating minigames.',
    'No entry fee on the daily path; showcase prize tier rotates at midnight.',
    'On web, rounds use Tap Dash & Tile Clash so everyone can finish; full rotation on the app.',
  ],
};
