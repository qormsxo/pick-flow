import { Injectable, Logger } from '@nestjs/common';
import { toFloat32Buffer } from '../common/utils/vector.util';
import { parseSearchReply } from './search-reply';
import { RedisService } from './redis.service';
import { VectorDocument, VectorHit, VectorIndexSpec, VectorStore } from './vector-store.interface';

@Injectable()
export class RedisVectorStore implements VectorStore {
  private readonly logger = new Logger(RedisVectorStore.name);

  constructor(private readonly redis: RedisService) {}

  async ensureIndex(spec: VectorIndexSpec): Promise<void> {
    try {
      await this.redis.command('FT.CREATE', this.schemaArgs(spec));
      this.logger.log(`Created vector index ${spec.name} dim=${spec.dimension}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/exist/i.test(message)) return;
      throw error;
    }
  }

  async upsert(spec: VectorIndexSpec, doc: VectorDocument, ttlSec?: number): Promise<void> {
    if (doc.embedding.length !== spec.dimension) {
      throw new Error(
        `Embedding dim ${doc.embedding.length} does not match index ${spec.name} dim ${spec.dimension}`,
      );
    }
    const key = `${spec.prefix}${doc.id}`;
    const args: Array<string | Buffer> = [key];
    for (const [field, value] of Object.entries(doc.fields)) {
      args.push(field, value);
    }
    args.push('embedding', toFloat32Buffer(doc.embedding));
    await this.redis.command('HSET', args);
    if (ttlSec && ttlSec > 0) {
      await this.redis.command('EXPIRE', [key, ttlSec]);
    }
  }

  async search(spec: VectorIndexSpec, embedding: number[], k: number): Promise<VectorHit[]> {
    if (k < 1) return [];
    const returnFields = ['dist', ...spec.storedTextFields, ...spec.tagFields, ...spec.numericFields];
    const args: Array<string | number | Buffer> = [
      spec.name,
      '*=>[KNN $k @embedding $vec AS dist]',
      'PARAMS',
      4,
      'k',
      k,
      'vec',
      toFloat32Buffer(embedding),
      'SORTBY',
      'dist',
      'RETURN',
      returnFields.length,
      ...returnFields,
      'DIALECT',
      2,
      'LIMIT',
      0,
      k,
    ];
    const reply = await this.redis.command('FT.SEARCH', args);
    return parseSearchReply(reply, spec.prefix);
  }

  async dropIndex(spec: VectorIndexSpec): Promise<void> {
    try {
      await this.redis.command('FT.DROPINDEX', [spec.name, 'DD']);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unknown index/i.test(message) || /no such index/i.test(message)) return;
      throw error;
    }
  }

  private schemaArgs(spec: VectorIndexSpec): Array<string | number> {
    const args: Array<string | number> = [
      spec.name,
      'ON',
      'HASH',
      'PREFIX',
      1,
      spec.prefix,
      'SCHEMA',
      'embedding',
      'VECTOR',
      'HNSW',
      10,
      'TYPE',
      'FLOAT32',
      'DIM',
      spec.dimension,
      'DISTANCE_METRIC',
      'COSINE',
      'M',
      16,
      'EF_CONSTRUCTION',
      200,
    ];
    for (const field of spec.storedTextFields) {
      args.push(field, 'TEXT', 'NOINDEX');
    }
    for (const field of spec.tagFields) {
      args.push(field, 'TAG');
    }
    for (const field of spec.numericFields) {
      args.push(field, 'NUMERIC');
    }
    return args;
  }
}
