import { buildProfile } from '../src/recommendations/profile.builder';

describe('buildProfile', () => {
  it('returns null without signals', () => {
    expect(buildProfile([], 4)).toBeNull();
  });

  it('lets a fresh strong signal dominate an old weak one', () => {
    const profile = buildProfile(
      [
        { embedding: [1, 0], weight: 1, ageMs: 0, category: 'outer' },
        { embedding: [0, 1], weight: 0.2, ageMs: 14 * 24 * 60 * 60 * 1000 * 10, category: 'electronics' },
      ],
      2,
    );

    expect(profile).not.toBeNull();
    expect(profile!.interestVector[0]).toBeGreaterThan(profile!.interestVector[1] ?? 0);
    const sum = Object.values(profile!.categoryWeights).reduce((total, value) => total + value, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(profile!.categoryWeights.outer).toBeGreaterThan(profile!.categoryWeights.electronics ?? 0);
  });
});
