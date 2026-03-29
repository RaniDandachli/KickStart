/** World-space obstacles — all X in the same endless coordinate system as `scroll`. */

export type Obstacle =
  | { kind: 'spike'; x0: number; x1: number; y0: number; y1: number; key: string }
  | { kind: 'gap'; x0: number; x1: number; key: string }
  | { kind: 'platform'; x0: number; x1: number; yTop: number; key: string }
  | { kind: 'ceiling'; x0: number; x1: number; y0: number; y1: number; key: string };

export type SegmentEndTag = 'flat' | 'gap' | 'spike' | 'air';

export interface SegmentModule {
  id: string;
  width: number;
  /** 0 intro … 3 endgame — used with `tierFromScroll`. */
  tierMin: number;
  tierMax: number;
  /** Previous segment must end with one of these tags. */
  startTags: SegmentEndTag[];
  endTag: SegmentEndTag;
  build: (baseX: number) => Obstacle[];
}

export interface PlayerSim {
  y: number;
  vy: number;
  alive: boolean;
  diedAtScroll: number | null;
  /** Best scroll while alive (distance proxy). */
  bestScroll: number;
  clearedKeys: Set<string>;
  streak: number;
  nearFlash: number;
  squash: number;
  dangerFlash: number;
  /** Pending jump input window (Geometry Dash–style jump buffer). */
  jumpBufferMs: number;
}
