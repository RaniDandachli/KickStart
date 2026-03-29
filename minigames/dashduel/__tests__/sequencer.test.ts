import { buildCourse } from '@/minigames/dashduel/sequencer';

describe('Dash Duel sequencer', () => {
  it('builds the same course for the same seed', () => {
    const a = buildCourse(42_424_242);
    const b = buildCourse(42_424_242);
    expect(a.length).toBe(b.length);
    expect(a.map((o) => `${o.kind}:${o.x0}`).join('|')).toBe(b.map((o) => `${o.kind}:${o.x0}`).join('|'));
  });

  it('differs when seed differs', () => {
    const a = buildCourse(1);
    const b = buildCourse(2);
    const sa = a.map((o) => o.key).join(',');
    const sb = b.map((o) => o.key).join(',');
    expect(sa).not.toBe(sb);
  });
});
