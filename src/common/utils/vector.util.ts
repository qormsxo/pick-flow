export function l2Normalize(values: number[]): number[] {
  let sum = 0;
  for (const value of values) sum += value * value;
  const norm = Math.sqrt(sum);
  if (norm === 0) {
    const fallback = new Array<number>(values.length).fill(0);
    if (fallback.length > 0) fallback[0] = 1;
    return fallback;
  }
  return values.map((value) => value / norm);
}

/** 둘 다 단위 벡터면 코사인 유사도는 내적과 같다. 범위는 -1 ~ 1. */
export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function addScaled(target: number[], source: number[], weight: number): void {
  const length = Math.min(target.length, source.length);
  for (let index = 0; index < length; index += 1) {
    target[index] = (target[index] ?? 0) + (source[index] ?? 0) * weight;
  }
}

/**
 * Redis VECTOR 필드는 JSON 배열이 아니라 Float32 little-endian 바이트다.
 * byteOffset 을 명시해야 풀링된 ArrayBuffer 의 앞쪽 쓰레기 바이트를 안 담는다.
 */
export function toFloat32Buffer(values: number[]): Buffer {
  const floats = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    floats[index] = values[index] ?? 0;
  }
  return Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);
}
