#!/usr/bin/env node

import prisma from '@/lib/prisma';
import { aesGcmDecrypt, aesGcmEncrypt, deriveKey } from '@/lib/crypto';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const seed = process.env.API_KEY_ENCRYPTION_SEED;

  if (!seed) {
    console.error('API_KEY_ENCRYPTION_SEED must be set to migrate API keys.');
    process.exitCode = 1;
    return;
  }

  const encryptionKey = await deriveKey(seed);
  try {
    const configs = await prisma.providerConfig.findMany({
      where: { apiKey: { not: null } },
      select: { id: true, provider: true, apiKey: true },
    });

    if (configs.length === 0) {
      console.log('No provider configurations found.');
      return;
    }

    console.log(`Scanning ${configs.length} provider configuration(s)...`);

    for (const config of configs) {
      const storedKey = config.apiKey;
      if (!storedKey) continue;

      if (storedKey.startsWith('v2:gcm:')) {
        try {
          await aesGcmDecrypt(encryptionKey, storedKey);
          console.log(`✔️  ${config.provider}: already encrypted (${config.id}).`);
        } catch (error) {
          console.warn(`⚠️  ${config.provider}: encrypted key failed to decrypt (${config.id}).`);
        }
        continue;
      }

      try {
        await aesGcmDecrypt(encryptionKey, storedKey);
        console.log(`✔️  ${config.provider}: encryption verified (${config.id}).`);
        continue;
      } catch (error) {
        // Key is likely plaintext; fall through to encryption path.
      }

      if (dryRun) {
        console.log(`DRY RUN → Would encrypt key for ${config.provider} (${config.id}).`);
        continue;
      }

      const encrypted = await aesGcmEncrypt(encryptionKey, storedKey);
      await prisma.providerConfig.update({
        where: { id: config.id },
        data: { apiKey: encrypted, updatedAt: new Date() },
      });

      console.log(`🔐 Encrypted API key for ${config.provider} (${config.id}).`);
    }

    console.log('Migration complete.');
  } catch (error) {
    process.exitCode = 1;
    console.error('Migration failed:', error instanceof Error ? error.message : error);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main();
