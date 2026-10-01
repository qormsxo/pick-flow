export function isDuplicateJobError(error: unknown): boolean {
  return error instanceof Error && /exist/i.test(error.message);
}
