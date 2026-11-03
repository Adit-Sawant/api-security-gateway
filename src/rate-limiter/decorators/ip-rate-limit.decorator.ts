import { SetMetadata } from '@nestjs/common';

export const IP_RATE_LIMIT_KEY = 'ip_rate_limit';

// export interface IpRateLimitOptions {
//   limit: number;
//   windowSeconds: number;
//   scope: string;
// }

export interface IpRateLimitOptions {
  scope: 'login' | 'register';
}



export const IpRateLimit = (options: IpRateLimitOptions) =>
  SetMetadata(IP_RATE_LIMIT_KEY, options);
