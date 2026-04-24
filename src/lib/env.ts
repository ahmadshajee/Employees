function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get MONGODB_URI(): string {
    return getRequiredEnv("MONGODB_URI");
  },
  get NEXTAUTH_SECRET(): string {
    return getRequiredEnv("NEXTAUTH_SECRET");
  },
  get NEXTAUTH_URL(): string | undefined {
    return (
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    );
  },
};
