export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
