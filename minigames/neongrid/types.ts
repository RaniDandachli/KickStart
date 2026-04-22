/** One cross-lane slice: index = lane (0..LANE_COUNT-1), true = hazard (blocked). */
export type LaneRow = readonly boolean[];

export type NeonGridRunStats = {
  score: number;
  durationMs: number;
  tapCount: number;
};
