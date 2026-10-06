export function isDuplicateJobError(error: Error): boolean {
  return /exist/i.test(error.message);
}
