import { registerAs } from '@nestjs/config';

export default registerAs('rateLimit', () => ({
  windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),

  plans: {
    FREE: Number(process.env.RATE_LIMIT_FREE ?? 60),
    PRO: Number(process.env.RATE_LIMIT_PRO ?? 600),
    ENTERPRISE: Number(process.env.RATE_LIMIT_ENTERPRISE ?? 3000),
  },

  authentication: {
    login: Number(process.env.RATE_LIMIT_LOGIN ?? 10),
    register: Number(process.env.RATE_LIMIT_REGISTER ?? 5),
  },
}));
