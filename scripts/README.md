# Enterprise-Grade Scripts

This directory contains enterprise-grade scripts for database management, environment validation, and security auditing of the RealMultiLLM application.

## Available Scripts

### 1. Database Migration & Setup (`db-migration.sh`)

Enterprise-grade database migration and setup script with zero-error guarantees:

- **Database Backup**: Automatically backs up existing databases before operations
- **Dependency Management**: Ensures all dependencies are properly installed
- **Migration Execution**: Runs Prisma migrations with error handling
- **Data Seeding**: Seeds database with initial data including demo users and personas
- **Database Optimization**: VACUUMs and analyzes SQLite and PostgreSQL databases
- **Documentation Generation**: Creates comprehensive database documentation

**Usage:**
```bash
# Run the complete database setup
bash scripts/db-migration.sh

# Or via npm script
npm run db:migration
```

### 2. Environment Validation (`env-validation.sh`)

Complete environment validation and pre-deployment check with zero-error deployment guarantees:

- **System Resources Check**: Verifies memory, disk space availability
- **Dependency Verification**: Checks Node.js, npm, and critical dependencies
- **Environment Variable Validation**: Ensures all required environment variables are set correctly
- **Security Vulnerability Scan**: Checks for critical security vulnerabilities
- **Build Configuration Verification**: Validates TypeScript, ESLint, and build configurations
- **Production Build Test**: Tests build process to catch issues before deployment

**Usage:**
```bash
# Run environment validation
bash scripts/env-validation.sh

# Or via npm script
npm run env:validation
```

### 3. Security Audit & Hardening (`security-audit.sh`)

Complete security validation and automated hardening script:

- **Secret Detection**: Scans for hardcoded secrets in codebase
- **Environment Security**: Validates environment variable strength and configuration
- **Dependency Vulnerability Scan**: Checks for security vulnerabilities
- **File Permission Hardening**: Sets appropriate permissions on sensitive files
- **Security Header Verification**: Ensures security headers are properly configured
- **Authentication Security**: Validates authentication configuration

**Usage:**
```bash
# Run security audit
bash scripts/security-audit.sh

# Or via npm script
npm run security:audit
```

## Integration with Package.json

These scripts are integrated with npm for easy execution:

- `npm run db:migration` - Run database migration setup
- `npm run env:validation` - Run environment validation
- `npm run security:audit` - Run security audit

## System Requirements

- **Operating Systems**: Mac M2 8GB, Mac Pro 2013 16GB (optimized)
- **Node.js**: Version 18+ (recommended: version 20+)
- **npm**: Latest stable version
- **jq**: For JSON processing (in environment validation script)
- **bc**: For floating-point calculations in resource checks

## Log Files

All scripts generate detailed logs in the following locations:

- **Database Migration**: `logs/db_migration_*YYYYMMDD_HHMMSS*.log`
- **Environment Validation**: `deployment-check-YYYYMMDD_HHMMSS.json`
- **Security Audit**: `security-audit-YYYYMMDD_HHMMSS.json`

## Best Practices

1. **Before Production Deployment**:
   - Run `npm run env:validation` to check all requirements
   - Run `npm run security:audit` to ensure security compliance
   - Review logs from both scripts

2. **Database Operations**:
   - Always run `npm run db:migration` when setting up new environments
   - Check logs after database operations
   - Ensure backups are properly configured

3. **Security**:
   - Run security audits regularly
   - Address all critical and high-severity issues immediately
   - Implement automated security scans in CI/CD

## Troubleshooting

- If scripts fail, check the generated log files for detailed error information
- Ensure all required environment variables are properly configured
- Verify system resources meet minimum requirements
- Make sure all dependencies are installed correctly

## Enterprise Features

These scripts have been optimized for enterprise-grade deployments with:
- Comprehensive error handling
- Detailed logging
- Automated hardening
- Validation against security standards
- Zero-error guarantees
- Detailed reporting