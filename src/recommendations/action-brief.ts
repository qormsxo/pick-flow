import { EVENT_WEIGHT, EventType } from '../events/event-type.enum';

export interface BriefProduct {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface BriefEvent {
  productId: string;
  type: EventType;
}

export interface ActionBrief {
  text: string;
  productIds: string[];
}

const MAX_LINES = 8;

const DESCRIPTION_LIMIT = 80;

/**
 * 상품마다 가장 무거운 행동만 남긴다.
 * 같은 상품을 여러 번 본 기록은 장면에 반복해서 넣지 않는다.
 */
export function buildActionBrief(events: BriefEvent[], products: Map<string, BriefProduct>): ActionBrief {
  const strongest = new Map<string, { weight: number; type: EventType; product: BriefProduct }>();

  for (const event of events) {
    const product = products.get(event.productId);
    const weight = EVENT_WEIGHT[event.type];

    if (!product || weight == null) continue;
    const current = strongest.get(product.id);

    if (!current || weight > current.weight) {
      strongest.set(product.id, { weight, type: event.type, product });
    }
  }

  const lines = [...strongest.values()]
    .sort((left, right) => right.weight - left.weight || left.product.name.localeCompare(right.product.name, 'ko'))
    .slice(0, MAX_LINES);

  return {
    productIds: lines.map((line) => line.product.id),
    text: lines
      .map((line) => {
        const description = line.product.description.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LIMIT);

        return `- ${line.type} | ${line.product.name} | ${line.product.category} | ${description}`;
      })
      .join('\n'),
  };
}
