export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAfterSeconds: number;
  retryAfterSeconds: number;
}