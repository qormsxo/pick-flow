import { QueryFailedError } from 'typeorm';

interface PgError {
  code?: string;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = (error as QueryFailedError & { driverError?: PgError }).driverError;
  return driverError?.code === '23505';
}
