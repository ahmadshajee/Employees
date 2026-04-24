function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getMongoUri(): string {
  let value = getRequiredEnv("MONGODB_URI").trim();

  // Accept values accidentally pasted as full assignment lines.
  if (value.startsWith("MONGODB_URI=")) {
    value = value.slice("MONGODB_URI=".length).trim();
  }

  // Strip optional wrapping quotes from secret managers.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (!value.startsWith("mongodb://") && !value.startsWith("mongodb+srv://")) {
    throw new Error(
      'Invalid MONGODB_URI: expected value to start with "mongodb://" or "mongodb+srv://"'
    );
  }

  return value;
}

export const env = {
  get MONGODB_URI(): string {
    return getMongoUri();
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
