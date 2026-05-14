import type { ComponentType } from 'react';
import { Platform } from 'react-native';

import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { AsyncH2hQueueSubmit, H2hSkillContestBundle } from '@/types/match';

export type NeonBallRunGameProps = {
  playMode?: 'practice' | 'prize';
  runSeed?: number;
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
  asyncH2hQueueSubmit?: AsyncH2hQueueSubmit;
};

const Comp: ComponentType<NeonBallRunGameProps> =
  Platform.OS === 'web' ? require('./BallRunGame.web').default : require('./BallRunGame.native').default;

export default Comp;
