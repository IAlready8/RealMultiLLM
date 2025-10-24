# Enterprise Scripts

This directory contains enterprise-grade automation scripts for the RealMultiLLM project. These scripts provide comprehensive solutions for database management, environment validation, security auditing, testing, performance optimization, and deployment automation.

## Script Overview

### 0_master_orchestration.sh
The master orchestration script that coordinates all other scripts in a complete enterprise pipeline. It provides both interactive and automated execution modes for the entire enterprise readiness process.

**Usage:**
```bash
# Interactive mode
./scripts/0_master_orchestration.sh

# Run full pipeline
./scripts/0_master_orchestration.sh --full
```

### 1_db_migration_complete.sh
Complete database migration and setup script with zero-error guarantees. Handles database creation, migration, seeding, and optimization for both SQLite and PostgreSQL.

### 2_env_validation_complete.sh
Comprehensive environment validation script that checks system resources, dependencies, configuration files, and service connections to ensure production readiness.

### 3_security_audit_complete.sh
Enterprise-grade security validation and hardening script that scans for vulnerabilities, validates configurations, and automatically applies security improvements.

### 4_testing_qa_complete.sh
Complete testing and quality assurance script that runs unit tests, integration tests, E2E tests, and performance validation to ensure code quality.

### 5_performance_optimization.sh
Script for optimizing application performance including Node.js memory settings, dependency optimization, Next.js configuration, database indexing, and bundle size reduction.

### 6_deployment_automation.sh
Enterprise-grade deployment automation with zero-downtime capability, rollback support, and comprehensive health checks for various deployment targets.

## Key Features

- **Enterprise-Grade**: Built to handle complex production environments
- **Zero-Error Guarantees**: Comprehensive error handling and recovery
- **Cross-Platform**: Optimized for Mac M2 8GB and Mac Pro 2013 16GB
- **Comprehensive Reporting**: Generates detailed reports for each process
- **Rollback Support**: Safe rollback capabilities for failed deployments
- **Interactive and Automated**: Both interactive and fully automated modes

## Requirements

- Node.js 18+
- npm
- git
- Additional tools depending on deployment target (Docker, Vercel CLI, etc.)

## Directory Structure

```
scripts/
├── 0_master_orchestration.sh      # Master orchestration script
├── 1_db_migration_complete.sh     # Database migration
├── 2_env_validation_complete.sh   # Environment validation
├── 3_security_audit_complete.sh   # Security audit
├── 4_testing_qa_complete.sh       # Testing & QA
├── 5_performance_optimization.sh  # Performance optimization
├── 6_deployment_automation.sh     # Deployment automation
├── README.md                      # This file
└── ... (other scripts)
```

## Best Practices

1. Always run `./scripts/0_master_orchestration.sh` in interactive mode first to understand the process
2. Ensure your `.env.local` file is properly configured before running any scripts
3. Regularly update dependencies with `npm update`
4. Run security audits regularly using `./scripts/3_security_audit_complete.sh`
5. Test deployments to staging before production

## Logs and Reports

All scripts generate detailed logs in the `logs/` directory and JSON reports for tracking results and compliance.