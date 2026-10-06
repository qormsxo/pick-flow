export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isJsonString(value: JsonValue | undefined): value is string {
  return typeof value === 'string';
}

export function isJsonNumber(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isJsonObject(value: JsonValue | null | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringList(value: JsonValue | undefined): value is string[] {
  return Array.isArray(value) && value.every(isJsonString);
}

export function isNumberList(value: JsonValue | undefined): value is number[] {
  return Array.isArray(value) && value.every(isJsonNumber);
}

/** JSON.parse 결과만 통과시킨다. 깨진 문자열은 undefined, JSON null 은 null 이다. */
export function readJson(text: string): JsonValue | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || isString(value) || typeof value === 'boolean') return true;

  if (typeof value === 'number') return Number.isFinite(value);

  if (Array.isArray(value)) return value.every(isJsonValue);

  if (typeof value !== 'object') return false;

  return Object.values(value).every(isJsonValue);
}
