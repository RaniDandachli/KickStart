export type CorridorSegment = {
  x0: number;
  x1: number;
  /** Top solid rectangle height (from y=0 down). */
  topH: number;
  /** Bottom solid rectangle height (from bottom up). */
  bottomH: number;
};

export type Spike = {
  /** World X centre of spike. */
  x: number;
  /** true = spike points down from top wall, false = points up from bottom wall. */
  onTop: boolean;
  /** Half-width for collision. */
  hw: number;
  /** Height (depth into corridor). */
  h: number;
};

export type NeonShipRunStats = {
  score: number;
  durationMs: number;
  tapCount: number;
};