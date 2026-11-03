export interface ICacheService {
  get<T>(key: string): Promise<T | null>;

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  delete(key: string): Promise<void>;

  incrementWithExpiry(
    key: string,
    ttlSeconds: number,
  ): Promise<{
    count: number;
    ttl: number;
  }>;

  consumeSlidingWindow(
    key: string,
    nowMs: number,
    windowMs: number,
    limit: number,
    requestId: string,
  ): Promise<{
    allowed: boolean;
    total: number;
    remaining: number;
    resetAfterSeconds: number;
    retryAfterSeconds: number;
  }>;

  ping(): Promise<string>;
}
