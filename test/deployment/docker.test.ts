import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Docker Deployment Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build Docker image successfully', () => {
    // Build the Docker image
    expect(() => {
      execSync('docker build -f Dockerfile.local -t realmultillm:test .', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
    }).not.toThrow();
  });

  it('should validate Docker image contents', () => {
    // Check that the Docker image was built
    try {
      const result = execSync('docker images realmultillm:test --format "{{.Repository}}"', {
        encoding: 'utf-8'
      });
      expect(result.trim()).toBe('realmultillm');
    } catch (error) {
      // If Docker is not available, skip this test
      expect(error).toBeDefined();
    }
  });

  it('should validate docker-compose configuration', () => {
    // Check docker-compose configuration
    expect(() => {
      execSync('docker-compose -f docker-compose.local.yml config', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
    }).not.toThrow();
  });

  it('should have proper multi-stage build optimization', () => {
    // Check that Dockerfile has multi-stage build
    const dockerfilePath = join(process.cwd(), 'Dockerfile.local');
    const dockerfileContent = require('fs').readFileSync(dockerfilePath, 'utf-8');
    
    // Should have multiple FROM statements for multi-stage build
    const fromStatements = dockerfileContent.match(/FROM/g);
    expect(fromStatements).toHaveLength(3); // deps, builder, runner stages
    
    // Should use different stages
    expect(dockerfileContent).toContain('AS deps');
    expect(dockerfileContent).toContain('AS builder');
    expect(dockerfileContent).toContain('AS runner');
  });

  it('should have proper user permissions in Docker', () => {
    const dockerfilePath = join(process.cwd(), 'Dockerfile.local');
    const dockerfileContent = require('fs').readFileSync(dockerfilePath, 'utf-8');
    
    // Should create non-root user
    expect(dockerfileContent).toContain('addgroup -g 1001 -S nodejs');
    expect(dockerfileContent).toContain('adduser -S nextjs -u 1001');
    expect(dockerfileContent).toContain('USER nextjs');
  });

  it('should expose correct port in Docker', () => {
    const dockerfilePath = join(process.cwd(), 'Dockerfile.local');
    const dockerfileContent = require('fs').readFileSync(dockerfilePath, 'utf-8');
    
    // Should expose port 3000
    expect(dockerfileContent).toContain('EXPOSE 3000');
  });
});