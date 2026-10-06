import { featureHashEmbedding } from '../src/ai/feature-hash';
import { cosineSimilarity } from '../src/common/utils/vector.util';

const DIM = 384;

describe('featureHashEmbedding', () => {
  const jacket = featureHashEmbedding('비 오는 날 입을 가벼운 자켓 추천해줘', DIM);
  const paraphrase = featureHashEmbedding('비오는 날 가벼운 재킷 추천', DIM);
  const keyboard = featureHashEmbedding('기계식 키보드 스위치 추천', DIM);

  const product = featureHashEmbedding(
    '라이트 레인 자켓. 비 오는 날 입기 좋은 가벼운 방수 자켓. outer. 자켓 비 가벼운 방수',
    DIM,
  );

  it('is deterministic and unit length', () => {
    const again = featureHashEmbedding('비 오는 날 입을 가벼운 자켓 추천해줘', DIM);
    expect(again).toEqual(jacket);
    expect(cosineSimilarity(jacket, jacket)).toBeCloseTo(1, 5);
  });

  it('ranks a paraphrase above an unrelated question', () => {
    const similar = cosineSimilarity(jacket, paraphrase);
    const different = cosineSimilarity(jacket, keyboard);
    expect(similar).toBeGreaterThan(different);
    expect(similar).toBeGreaterThan(0.86);
    expect(different).toBeLessThan(0.86);
  });

  it('places the jacket question nearer the jacket product than the keyboard question', () => {
    expect(cosineSimilarity(jacket, product)).toBeGreaterThan(cosineSimilarity(keyboard, product));
  });
});
