import { QueryFailedError } from 'typeorm';
import { isString } from '../common/utils/json-value';

export function isUniqueViolation(error: unknown): error is QueryFailedError {
  return error instanceof QueryFailedError && isPostgresUnique(error.driverError);
}

function isPostgresUnique(error: Error): boolean {
  return hasStringCode(error) && error.code === '23505';
}

function hasStringCode(error: Error): error is Error & { code: string } {
  return 'code' in error && isString(error.code);
}
