export function validateEnvironment(config: Record<string, unknown>) {
  function getPositiveInteger(key: string, defaultValue: number): number {
    const rawValue = config[key];

    const value =
      rawValue === undefined || rawValue === ''
        ? defaultValue
        : Number(rawValue);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(
        `Invalid environment variable ${key}: must be a positive integer.`,
      );
    }

    return value;
  }

  return {
    ...config,

    RATE_LIMIT_WINDOW_SECONDS: getPositiveInteger(
      'RATE_LIMIT_WINDOW_SECONDS',
      60,
    ),

    RATE_LIMIT_FREE: getPositiveInteger('RATE_LIMIT_FREE', 60),

    RATE_LIMIT_PRO: getPositiveInteger('RATE_LIMIT_PRO', 600),

    RATE_LIMIT_ENTERPRISE: getPositiveInteger('RATE_LIMIT_ENTERPRISE', 3000),

    RATE_LIMIT_LOGIN: getPositiveInteger('RATE_LIMIT_LOGIN', 10),

    RATE_LIMIT_REGISTER: getPositiveInteger('RATE_LIMIT_REGISTER', 5),
  };
}
