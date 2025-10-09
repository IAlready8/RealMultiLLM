#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { storeUserApiKey } from '@/lib/api-key-service';

interface ImportConfig {
  provider: string;
  isActive?: boolean;
  settings?: Record<string, unknown>;
}

async function main(): Promise<void> {
  const [, , userIdArg, fileArg] = process.argv;

  if (!userIdArg || !fileArg) {
    console.error('Usage: npx tsx scripts/import-configs.ts <user-id> <configs.json>');
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const fileContents = await fs.readFile(filePath, 'utf8');

  let entries: ImportConfig[];
  try {
    const parsed = JSON.parse(fileContents);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected an array of provider configurations');
    }
    entries = parsed;
  } catch (error) {
    console.error('Failed to parse configuration file:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  if (entries.length === 0) {
    console.log('No configurations found in file.');
    return;
  }

  for (const entry of entries) {
    if (!entry?.provider) {
      console.log('Skipping entry without provider id.');
      continue;
    }

    if (entry.isActive === false) {
      console.log(`Skipping ${entry.provider} (marked inactive).`);
      continue;
    }

    const prompt = `Enter API key for ${entry.provider} (leave blank to skip): `;
    const apiKey = (await promptInput(prompt)).trim();

    if (!apiKey) {
      console.log(`Skipped ${entry.provider}.`);
      continue;
    }

    await storeUserApiKey(
      userIdArg,
      entry.provider,
      apiKey,
      entry.settings as Record<string, unknown> | undefined
    );
    console.log(`Imported configuration for ${entry.provider}.`);
  }
}

async function promptInput(question: string): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

void main();
