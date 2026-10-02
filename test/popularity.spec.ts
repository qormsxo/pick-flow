import { decayedScore, rankPopularity } from '../src/events/popularity';

describe('rankPopularity', () => {
  it('오늘 점수가 같으면 오래된 날의 점수는 낮게 친다', () => {
    const ids = rankPopularity(
      [
        { ageDays: 0, rows: [{ member: 'today', score: 1 }] },
        { ageDays: 14, rows: [{ member: 'old', score: 1 }] },
      ],
      2,
    );

    expect(decayedScore(1, 14)).toBeCloseTo(0.5);
    expect(ids).toEqual(['today', 'old']);
  });

  it('하루 점수를 상품별로 합친다', () => {
    const ids = rankPopularity(
      [
        {
          ageDays: 0,
          rows: [
            { member: 'coat', score: 1 },
            { member: 'cup', score: 1.8 },
          ],
        },
        { ageDays: 0, rows: [{ member: 'coat', score: 1.3 }] },
      ],
      1,
    );

    expect(ids).toEqual(['coat']);
  });
});