import { parseSearchReply } from '../src/redis/search-reply';

describe('parseSearchReply', () => {
  it('converts cosine distance into similarity and strips the key prefix', () => {
    const reply = [1, 'sc:abc', ['dist', '0.08', 'payload', '{"answer":"hi"}', 'question', '자켓']];
    const hits = parseSearchReply(reply, 'sc:');
    expect(hits).toEqual([
      {
        id: 'abc',
        distance: 0.08,
        similarity: 0.92,
        fields: {
          dist: '0.08',
          payload: '{"answer":"hi"}',
          question: '자켓',
        },
      },
    ]);
  });

  it('returns an empty list for an empty index', () => {
    expect(parseSearchReply([0], 'sc:')).toEqual([]);
  });
});
