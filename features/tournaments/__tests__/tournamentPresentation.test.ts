import { formatEntryType, formatFormat, formatTournamentState } from '../tournamentPresentation';

describe('tournamentPresentation', () => {
  it('formats states', () => {
    expect(formatTournamentState('open')).toBe('Open');
    expect(formatTournamentState('completed')).toBe('Completed');
  });

  it('formats entry types', () => {
    expect(formatEntryType('sponsor')).toBe('Sponsor funded');
  });

  it('formats bracket types', () => {
    expect(formatFormat('round_robin')).toContain('Round robin');
  });
});
