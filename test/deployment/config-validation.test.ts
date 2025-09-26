import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Deployment Configuration Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have valid Docker configuration', () => {
    // Check that Dockerfile exists
    const dockerfilePath = join(process.cwd(), 'Dockerfile.local');
    expect(existsSync(dockerfilePath)).toBe(true);
    
    // Check that docker-compose file exists
    const dockerComposePath = join(process.cwd(), 'docker-compose.local.yml');
    expect(existsSync(dockerComposePath)).toBe(true);
    
    // Check Dockerfile content
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');
    expect(dockerfileContent).toContain('FROM node:20-alpine');
    expect(dockerfileContent).toContain('WORKDIR /app');
    expect(dockerfileContent).toContain('COPY package*.json ./');
    
    // Check docker-compose content
    const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8');
    expect(dockerComposeContent).toContain('version: \'3.8\'');
    expect(dockerComposeContent).toContain('ports:');
    expect(dockerComposeContent).toContain('volumes:');
  });

  it('should have valid Next.js configuration', () => {
    // Check that next.config.mjs exists
    const nextConfigPath = join(process.cwd(), 'next.config.mjs');
    expect(existsSync(nextConfigPath)).toBe(true);
    
    // Check Next.js config content
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');
    expect(nextConfigContent).toContain('webpack:');
    expect(nextConfigContent).toContain('config.resolve.alias');
  });

  it('should have required environment variables', () => {
    // Check that .env.example exists
    const envExamplePath = join(process.cwd(), '.env.example');
    expect(existsSync(envExamplePath)).toBe(true);
    
    // Check required environment variables
    const envExampleContent = readFileSync(envExamplePath, 'utf-8');
    expect(envExampleContent).toContain('NEXTAUTH_SECRET=');
    expect(envExampleContent).toContain('OPENAI_API_KEY=');
    expect(envExampleContent).toContain('ANTHROPIC_API_KEY=');
    expect(envExampleContent).toContain('GOOGLE_AI_API_KEY=');
  });

  it('should have valid package.json scripts for deployment', () => {
    // Check that package.json exists
    const packageJsonPath = join(process.cwd(), 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);
    
    // Check required scripts
    const packageJsonContent = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJsonContent.scripts).toHaveProperty('build');
    expect(packageJsonContent.scripts).toHaveProperty('start');
    expect(packageJsonContent.scripts).toHaveProperty('dev');
    
    // Check that build script is correct
    expect(packageJsonContent.scripts.build).toBe('next build');
    
    // Check that start script is correct
    expect(packageJsonContent.scripts.start).toBe('next start');
  });

  it('should have proper TypeScript configuration', () => {
    // Check that tsconfig.json exists
    const tsConfigPath = join(process.cwd(), 'tsconfig.json');
    expect(existsSync(tsConfigPath)).toBe(true);
    
    // Check tsconfig content
    const tsConfigContent = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));
    expect(tsConfigContent.compilerOptions).toHaveProperty('target');
    expect(tsConfigContent.compilerOptions).toHaveProperty('lib');
    expect(tsConfigContent.compilerOptions).toHaveProperty('module');
  });

  it('should have valid Prisma configuration', () => {
    // Check that prisma directory exists
    const prismaDirPath = join(process.cwd(), 'prisma');
    expect(existsSync(prismaDirPath)).toBe(true);
    
    // Check that schema.prisma exists
    const schemaPath = join(prismaDirPath, 'schema.prisma');
    expect(existsSync(schemaPath)).toBe(true);
  });
});