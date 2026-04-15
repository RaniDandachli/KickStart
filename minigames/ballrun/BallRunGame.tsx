import type { ComponentType } from 'react';
import { Platform } from 'react-native';

import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { H2hSkillContestBundle } from '@/types/match';

export type NeonBallRunGameProps = {
  playMode?: 'practice' | 'prize';
  runSeed?: number;
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
};

const Comp: ComponentType<NeonBallRunGameProps> =
  Platform.OS === 'web' ? require('./BallRunGame.web').default : require('./BallRunGame.native').default;

export default Comp;
