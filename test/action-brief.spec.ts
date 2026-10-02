import { EventType } from '../src/events/event-type.enum';
import { buildActionBrief, BriefProduct } from '../src/recommendations/action-brief';

const coat: BriefProduct = {
  id: 'coat',
  name: '울 코트',
  category: 'outer',
  description: '비 오는 날 가볍게 걸치는 방수 코트',
};
const tumbler: BriefProduct = {
  id: 'tumbler',
  name: '텀블러',
  category: 'living',
  description: '보온 텀블러',
};

describe('buildActionBrief', () => {
  const products = new Map([
    [coat.id, coat],
    [tumbler.id, tumbler],
  ]);

  it('같은 상품은 가장 무거운 행동만 남긴다', () => {
    const brief = buildActionBrief(
      [
        { productId: coat.id, type: EventType.VIEW },
        { productId: coat.id, type: EventType.PURCHASE },
        { productId: tumbler.id, type: EventType.LIKE },
      ],
      products,
    );

    expect(brief.productIds).toEqual([coat.id, tumbler.id]);
    expect(brief.text.startsWith('- PURCHASE | 울 코트 | outer |')).toBe(true);
    expect(brief.text).toContain('- LIKE | 텀블러 | living |');
    expect(brief.text).not.toContain('VIEW');
  });

  it('행동이 없으면 빈 문장이다', () => {
    expect(buildActionBrief([], products)).toEqual({ text: '', productIds: [] });
  });
});
