#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { getUserProviderConfigs } from '@/lib/api-key-service';

interface ExportConfig {
  provider: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

async function main(): Promise<void> {
  const [, , userIdArg, outputPathArg] = process.argv;

  if (!userIdArg) {
    console.error('Usage: npx tsx scripts/export-configs.ts <user-id> [output.json]');
    process.exitCode = 1;
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : path.resolve(process.cwd(), `provider-configs-${userIdArg}-${timestamp}.json`);

  const configs = await getUserProviderConfigs(userIdArg);

  if (configs.length === 0) {
    console.log('No active provider configurations found for user.');
    return;
  }

  const exportPayload: ExportConfig[] = configs.map(config => ({
    provider: config.provider,
    isActive: config.isActive,
    settings: config.settings,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }));

  await fs.writeFile(outputPath, JSON.stringify(exportPayload, null, 2), 'utf8');

  console.log(`Exported ${exportPayload.length} provider configuration(s) to ${outputPath}`);
}

void main();
