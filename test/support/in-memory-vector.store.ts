import { cosineSimilarity } from '../../src/common/utils/vector.util';
import { VectorDocument, VectorHit, VectorIndexSpec, VectorStore } from '../../src/redis/vector-store.interface';

export class InMemoryVectorStore implements VectorStore {
  private readonly docs = new Map<string, { embedding: number[]; fields: Record<string, string> }>();

  async ensureIndex(): Promise<void> {
    return undefined;
  }

  async dropIndex(spec: VectorIndexSpec): Promise<void> {
    for (const key of [...this.docs.keys()]) {
      if (key.startsWith(spec.prefix)) this.docs.delete(key);
    }
  }

  async upsert(spec: VectorIndexSpec, doc: VectorDocument): Promise<void> {
    this.docs.set(`${spec.prefix}${doc.id}`, {
      embedding: [...doc.embedding],
      fields: { ...doc.fields },
    });
  }

  async search(spec: VectorIndexSpec, embedding: number[], k: number): Promise<VectorHit[]> {
    const hits: VectorHit[] = [];
    for (const [key, doc] of this.docs) {
      if (!key.startsWith(spec.prefix)) continue;
      const similarity = cosineSimilarity(embedding, doc.embedding);
      hits.push({
        id: key.slice(spec.prefix.length),
        similarity,
        distance: 1 - similarity,
        fields: doc.fields,
      });
    }
    hits.sort((left, right) => right.similarity - left.similarity);
    return hits.slice(0, k);
  }
}
