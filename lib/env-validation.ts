export function validateRequiredEnvVars() {
  const required = [
    'NEXTAUTH_SECRET',
    'DATABASE_URL'
  ];
  
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate auth providers have both client ID and secret
  const authProviders = [
    { name: 'Google', id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
    { name: 'GitHub', id: 'GITHUB_CLIENT_ID', secret: 'GITHUB_CLIENT_SECRET' }
  ];
  
  authProviders.forEach(provider => {
    const hasId = process.env[provider.id];
    const hasSecret = process.env[provider.secret];
    
    if (hasId && !hasSecret) {
      throw new Error(`${provider.name} provider requires both client ID and secret`);
    }
    if (!hasId && hasSecret) {
      throw new Error(`${provider.name} provider requires both client ID and secret`);
    }
  });
}

export function validateNextAuthSecret() {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for authentication');
  }
  
  if (process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters long');
  }
}

export function validateEncryptionKey() {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required for secure API key storage');
  }
  
  if (process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
}

export function getEncryptionKey(): string {
  // In development, create a default key if none provided
  if (process.env.NODE_ENV === 'development' && !process.env.ENCRYPTION_KEY) {
    return 'dev-encryption-key-1234567890123456'; // 32 chars
  }
  validateEncryptionKey();
  return process.env.ENCRYPTION_KEY!;
}