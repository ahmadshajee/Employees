function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  MONGODB_URI: getRequiredEnv("MONGODB_URI"),
  NEXTAUTH_SECRET: getRequiredEnv("NEXTAUTH_SECRET"),
  NEXTAUTH_URL:
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
};
