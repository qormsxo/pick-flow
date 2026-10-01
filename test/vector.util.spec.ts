import { cosineSimilarity, l2Normalize, toFloat32Buffer } from '../src/common/utils/vector.util';

describe('vector util', () => {
  it('normalizes to unit length', () => {
    const vector = l2Normalize([3, 4]);
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
  });

  it('treats orthogonal vectors as zero', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('encodes float32 little-endian bytes', () => {
    const buffer = toFloat32Buffer([1, -2]);
    expect(buffer).toHaveLength(8);
    expect(buffer.readFloatLE(0)).toBeCloseTo(1, 5);
    expect(buffer.readFloatLE(4)).toBeCloseTo(-2, 5);
  });
});
