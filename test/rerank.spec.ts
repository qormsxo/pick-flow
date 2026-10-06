import { parseRerank } from '../src/recommendations/rerank';

describe('parseRerank', () => {
  const allowed = new Set(['a', 'b']);

  it('후보에 없는 id 와 중복을 버린다', () => {
    const text = JSON.stringify([
      { product_id: 'missing', rank: 1, reason: '없는 상품' },
      { product_id: 'b', rank: 2, reason: '두번째' },
      { product_id: 'a', rank: 3, reason: '첫번째 후보' },
      { product_id: 'b', rank: 4, reason: '중복' },
    ]);

    expect(parseRerank(text, allowed, 10)).toEqual([
      { productId: 'b', rank: 1, reason: '두번째' },
      { productId: 'a', rank: 2, reason: '첫번째 후보' },
    ]);
  });

  it('깨진 JSON 은 빈 목록이다', () => {
    expect(parseRerank('not-json', allowed, 10)).toEqual([]);
  });
});
