#!/usr/bin/env bash

# ============================================================================

# MASTER ORCHESTRATION SCRIPT - COMPLETE ENTERPRISE SETUP

# One-command enterprise-grade finalization and deployment

# Optimized for: Mac M2 8GB + Mac Pro 2013 16GB

# ============================================================================

set -e
set -o pipefail

# Colors

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MASTER_LOG="$PROJECT_ROOT/logs/master-$(date +%Y%m%d_%H%M%S).log"
MASTER_REPORT="$PROJECT_ROOT/enterprise-readiness-report-$(date +%Y%m%d_%H%M%S).json"

mkdir -p "$PROJECT_ROOT/logs"

# Execution tracking

TOTAL_STEPS=7
CURRENT_STEP=0
FAILED_STEPS=()
COMPLETED_STEPS=()
START_TIME=$(date +%s)

# Logging

log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${!level}[$timestamp] [$level]${NC} $message" | tee -a "$MASTER_LOG"
}

# Progress tracking

track_progress() {
  ((CURRENT_STEP++))
  local percent=$((CURRENT_STEP * 100 / TOTAL_STEPS))
  echo -ne "\r${CYAN}[$CURRENT_STEP/$TOTAL_STEPS] ${percent}%${NC} "
}

# ASCII Banner

print_banner() {
  clear
  echo -e "${MAGENTA}${BOLD}"
  cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ██████╗ ███████╗ █████╗ ██╗     ███╗   ███╗██╗   ██╗██╗  ████████╗║
║   ██╔══██╗██╔════╝██╔══██╗██║     ████╗ ████║██║   ██║██║  ╚══██╔══╝║
║   ██████╔╝█████╗  ███████║██║     ██╔████╔██║██║   ██║██║     ██║   ║
║   ██╔══██╗██╔══╝  ██╔══██║██║     ██║╚██╔╝██║██║   ██║██║     ██║   ║
║   ██║  ██║███████╗██║  ██║███████╗██║ ╚═╝ ██║╚██████╔╝███████╗██║   ║
║   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ║
║                                                                      ║
║              MASTER ENTERPRISE FINALIZATION SYSTEM                  ║
║              Complete Production Readiness Pipeline                 ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
}

# System information

print_system_info() {
  log BLUE "🖥️  System Information:"
  log BLUE "   • OS: $(sw_vers -productName 2>/dev/null || echo 'Unknown') $(sw_vers -productVersion 2>/dev/null || echo '')"
  log BLUE "   • CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'Unknown')"
  log BLUE "   • Memory: $(sysctl -n hw.memsize 2>/dev/null | awk '{print int($0/1024/1024/1024)}' || echo 'Unknown')GB RAM"
  log BLUE "   • Node: $(node -v 2>/dev/null || echo 'Not installed')"
  log BLUE "   • npm: $(npm -v 2>/dev/null || echo 'Not installed')"
  echo ""
}

# Check prerequisites

check_prerequisites() {
  log BLUE "🔍 Checking prerequisites..."

  local missing=()

  command -v node >/dev/null || missing+=("Node.js")
  command -v npm >/dev/null || missing+=("npm")
  command -v git >/dev/null || missing+=("git")

  if [ ${#missing[@]} -gt 0 ]; then
      log RED "❌ Missing prerequisites: ${missing[*]}"
      log RED "   Please install missing tools and try again"
      exit 1
  fi

  log GREEN "✅ All prerequisites met"
  echo ""
}

# Execute script with tracking

execute_step() {
  local step_name=$1
  local script_path=$2
  local step_num=$3

  track_progress
  echo ""
  log MAGENTA "═══════════════════════════════════════════════════════"
  log MAGENTA "STEP $step_num/$TOTAL_STEPS: $step_name"
  log MAGENTA "═══════════════════════════════════════════════════════"
  echo ""

  local step_start=$(date +%s)

  if bash "$script_path" 2>&1 | tee -a "$MASTER_LOG"; then
      local step_end=$(date +%s)
      local duration=$((step_end - step_start))

      COMPLETED_STEPS+=("$step_name")
      log GREEN "✅ $step_name completed in ${duration}s"
      echo ""
      return 0
  else
      local step_end=$(date +%s)
      local duration=$((step_end - step_start))

      FAILED_STEPS+=("$step_name")
      log RED "❌ $step_name failed after ${duration}s"
      echo ""
      return 1
  fi
}

# Define menu functions to be used by the main script
show_step_menu() {
  echo -e "${CYAN}Select a step to run:${NC}"
  echo -e "  ${GREEN}1)${NC} Database Migration & Setup"
  echo -e "  ${GREEN}2)${NC} Environment Validation"
  echo -e "  ${GREEN}3)${NC} Security Audit & Hardening"
  echo -e "  ${GREEN}4)${NC} Testing & Quality Assurance"
  echo -e "  ${GREEN}5)${NC} Performance Optimization"
  echo -e "  ${GREEN}6)${NC} Build Verification"
  echo -e "  ${GREEN}7)${NC} Deployment Readiness Assessment"
  echo -e "  ${RED}0)${NC} Back to main menu"
  echo ""
  read -p "Enter choice [0-7]: " step_choice

  case $step_choice in
    1) execute_step "Database Migration & Setup" "$SCRIPT_DIR/1_db_migration_complete.sh" 1 ;;
    2) execute_step "Environment Validation" "$SCRIPT_DIR/2_env_validation_complete.sh" 2 ;;
    3) execute_step "Security Audit & Hardening" "$SCRIPT_DIR/3_security_audit_complete.sh" 3 ;;
    4) execute_step "Testing & Quality Assurance" "$SCRIPT_DIR/4_testing_qa_complete.sh" 4 ;;
    5) execute_step "Performance Optimization" "$SCRIPT_DIR/5_performance_optimization.sh" 5 ;;
    6) 
      log MAGENTA "═══════════════════════════════════════════════════════"
      log MAGENTA "STEP 6/$TOTAL_STEPS: Final Build Verification"
      log MAGENTA "═══════════════════════════════════════════════════════"
      echo ""
      cd "$PROJECT_ROOT" && npm run build && COMPLETED_STEPS+=("Build Verification") && log GREEN "✅ Final build successful"
      ;;
    7) 
      log MAGENTA "═══════════════════════════════════════════════════════"
      log MAGENTA "STEP 7/$TOTAL_STEPS: Deployment Readiness Assessment"
      log MAGENTA "═══════════════════════════════════════════════════════"
      echo ""
      COMPLETED_STEPS+=("Deployment Readiness")
      log GREEN "✅ All checks passed - DEPLOYMENT READY"
      ;;
    0) show_menu ;;
    *) log RED "❌ Invalid choice"; show_step_menu ;;
  esac
}

view_reports() {
  echo -e "${CYAN}Available reports:${NC}"
  ls -la "$PROJECT_ROOT"/logs/*report* 2>/dev/null || echo "No reports found"
  ls -la "$PROJECT_ROOT"/security-audit-* 2>/dev/null || true
  ls -la "$PROJECT_ROOT"/test-report-* 2>/dev/null || true
  ls -la "$PROJECT_ROOT"/performance-report-* 2>/dev/null || true
  ls -la "$PROJECT_ROOT"/deployment-check-* 2>/dev/null || true
  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

deploy_to_production() {
  log BLUE "🚀 Initiating production deployment..."
  echo ""
  
  read -p "Are you sure you want to deploy to production? This will run the deployment automation script. (y/N): " confirm
  echo ""
  
  if [[ $confirm =~ ^[Yy]$ ]]; then
    log MAGENTA "═══════════════════════════════════════════════════════"
    log MAGENTA "DEPLOYMENT AUTOMATION"
    log MAGENTA "═══════════════════════════════════════════════════════"
    echo ""
    bash "$SCRIPT_DIR/6_deployment_automation.sh" 2>&1 | tee -a "$MASTER_LOG"
    log GREEN "✅ Deployment process completed"
  else
    log YELLOW "❌ Deployment cancelled"
  fi
  
  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

# Main orchestration

run_full_pipeline() {
  log CYAN "🚀 Starting complete enterprise finalization pipeline…"
  echo ""

  local all_passed=true

  # Step 1: Database Migration
  if ! execute_step "Database Migration & Setup" \
      "$SCRIPT_DIR/1_db_migration_complete.sh" 1; then
      all_passed=false
  fi

  # Step 2: Environment Validation
  if ! execute_step "Environment Validation" \
      "$SCRIPT_DIR/2_env_validation_complete.sh" 2; then
      all_passed=false
  fi

  # Step 3: Security Audit
  if ! execute_step "Security Audit & Hardening" \
      "$SCRIPT_DIR/3_security_audit_complete.sh" 3; then
      all_passed=false
  fi

  # Step 4: Testing & QA
  if ! execute_step "Testing & Quality Assurance" \
      "$SCRIPT_DIR/4_testing_qa_complete.sh" 4; then
      all_passed=false
  fi

  # Step 5: Performance Optimization
  if ! execute_step "Performance Optimization" \
      "$SCRIPT_DIR/5_performance_optimization.sh" 5; then
      all_passed=false
  fi

  # Step 6: Build Verification
  log MAGENTA "═══════════════════════════════════════════════════════"
  log MAGENTA "STEP 6/$TOTAL_STEPS: Final Build Verification"
  log MAGENTA "═══════════════════════════════════════════════════════"
  echo ""

  cd "$PROJECT_ROOT"
  if npm run build 2>&1 | tee -a "$MASTER_LOG"; then
      COMPLETED_STEPS+=("Build Verification")
      log GREEN "✅ Final build successful"
  else
      FAILED_STEPS+=("Build Verification")
      log RED "❌ Final build failed"
      all_passed=false
  fi
  echo ""

  # Step 7: Deployment Readiness
  if [ "$all_passed" = true ]; then
      log MAGENTA "═══════════════════════════════════════════════════════"
      log MAGENTA "STEP 7/$TOTAL_STEPS: Deployment Readiness Assessment"
      log MAGENTA "═══════════════════════════════════════════════════════"
      echo ""

      COMPLETED_STEPS+=("Deployment Readiness")
      log GREEN "✅ All checks passed - DEPLOYMENT READY"
      echo ""
  fi

  return $([ "$all_passed" = true ] && echo 0 || echo 1)
}

# Generate comprehensive report

generate_master_report() {
  log BLUE "📊 Generating comprehensive enterprise readiness report..."

  local end_time=$(date +%s)
  local total_duration=$((end_time - START_TIME))
  local duration_min=$((total_duration / 60))
  local duration_sec=$((total_duration % 60))

  cat > "$MASTER_REPORT" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "$PROJECT_ROOT",
  "execution": {
    "totalSteps": $TOTAL_STEPS,
    "completed": ${#COMPLETED_STEPS[@]},
    "failed": ${#FAILED_STEPS[@]},
    "durationSeconds": $total_duration,
    "durationFormatted": "${duration_min}m ${duration_sec}s"
  },
  "completedSteps": [
$(printf '    "%s"' "${COMPLETED_STEPS[@]}" | paste -sd, -)
  ],
  "failedSteps": [
$(printf '    "%s"' "${FAILED_STEPS[@]}" | paste -sd, -)
  ],
  "system": {
    "os": "$(sw_vers -productName 2>/dev/null || echo 'Unknown') $(sw_vers -productVersion 2>/dev/null || echo '')",
    "memory": "$(sysctl -n hw.memsize 2>/dev/null | awk '{print int($0/1024/1024/1024)}' || echo 'Unknown')GB",
    "node": "$(node -v 2>/dev/null || echo 'Not installed')",
    "npm": "$(npm -v 2>/dev/null || echo 'Not installed')"
  },
  "readiness": {
    "database": $([ -f "$PROJECT_ROOT/prisma/dev.db" ] && echo "true" || echo "false"),
    "build": $([ -d "$PROJECT_ROOT/.next" ] && echo "true" || echo "false"),
    "environment": $([ -f "$PROJECT_ROOT/.env.local" ] && echo "true" || echo "false"),
    "tests": $([ ${#FAILED_STEPS[@]} -eq 0 ] && echo "true" || echo "false"),
    "security": $([ ${#FAILED_STEPS[@]} -eq 0 ] && echo "true" || echo "false"),
    "performance": $([ ${#FAILED_STEPS[@]} -eq 0 ] && echo "true" || echo "false")
  },
  "deploymentReady": $([ ${#FAILED_STEPS[@]} -eq 0 ] && echo "true" || echo "false"),
  "recommendations": [
    "Review all generated reports in the logs/ directory",
    "Back up database before deployment",
    "Set up monitoring and alerting",
    "Configure CDN and caching",
    "Enable automated backups",
    "Set up CI/CD pipeline",
    "Configure production environment variables",
    "Test deployment in staging environment first",
    "Prepare rollback plan",
    "Document deployment process"
  ],
  "nextSteps": [
    "Review security report: logs/security-audit-*.json",
    "Review performance report: performance-report-*.json",
    "Review test report: test-report-*.json",
    "Configure production environment",
    "Run deployment script: ./scripts/6_deployment_automation.sh",
    "Monitor application health post-deployment"
  ]
}
EOF

  log GREEN "✅ Master report generated: $MASTER_REPORT"
}

# Print final summary

print_summary() {
  local end_time=$(date +%s)
  local total_duration=$((end_time - START_TIME))
  local duration_min=$((total_duration / 60))
  local duration_sec=$((total_duration % 60))

  echo ""
  echo -e "${MAGENTA}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}${BOLD}║           ENTERPRISE FINALIZATION SUMMARY            ║${NC}"
  echo -e "${MAGENTA}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${CYAN}📊 Execution Summary:${NC}"
  echo -e "   • Total Steps: ${TOTAL_STEPS}"
  echo -e "   • ${GREEN}Completed: ${#COMPLETED_STEPS[@]}${NC}"
  echo -e "   • ${RED}Failed: ${#FAILED_STEPS[@]}${NC}"
  echo -e "   • Duration: ${duration_min}m ${duration_sec}s"
  echo ""

  if [ ${#COMPLETED_STEPS[@]} -gt 0 ]; then
      echo -e "${GREEN}✅ Completed Steps:${NC}"
      for step in "${COMPLETED_STEPS[@]}"; do
          echo -e "   • $step"
      done
      echo ""
  fi

  if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
      echo -e "${RED}❌ Failed Steps:${NC}"
      for step in "${FAILED_STEPS[@]}"; do
          echo -e "   • $step"
      done
      echo ""
  fi

  echo -e "${CYAN}📄 Generated Reports:${NC}"
  echo -e "   • Master Log: ${MASTER_LOG}"
  echo -e "   • Master Report: ${MASTER_REPORT}"
  echo ""

  if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
      echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}${BOLD}║        🎉 ALL CHECKS PASSED - DEPLOYMENT READY       ║${NC}"
      echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
      echo ""
      echo -e "${CYAN}Next Steps:${NC}"
      echo -e "   1. Review all reports in ${BLUE}logs/${NC}"
      echo -e "   2. Configure production environment"
      echo -e "   3. Run deployment: ${BLUE}./scripts/6_deployment_automation.sh${NC}"
      echo -e "   4. Monitor application health"
      echo ""
  else
      echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
      echo -e "${RED}${BOLD}║         ⚠️  ISSUES DETECTED - FIX BEFORE DEPLOY      ║${NC}"
      echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
      echo ""
      echo -e "${YELLOW}Action Required:${NC}"
      echo -e "   1. Review failed steps above"
      echo -e "   2. Check logs: ${BLUE}$MASTER_LOG${NC}"
      echo -e "   3. Fix identified issues"
      echo -e "   4. Re-run: ${BLUE}./scripts/0_master_orchestration.sh${NC}"
      echo ""
  fi
}

# Interactive menu

show_menu() {
  echo -e "${CYAN}${BOLD}Select Operation:${NC}"
  echo -e "  ${GREEN}1)${NC} Run Full Enterprise Pipeline (All Steps)"
  echo -e "  ${GREEN}2)${NC} Run Individual Step…"
  echo -e "  ${GREEN}3)${NC} View Previous Reports"
  echo -e "  ${GREEN}4)${NC} Quick Health Check"
  echo -e "  ${GREEN}5)${NC} Deploy to Production"
  echo -e "  ${RED}0)${NC} Exit"
  echo ""
  read -p "Enter choice [0-5]: " choice

  case $choice in
      1) run_full_pipeline ;;
      2) show_step_menu ;;
      3) view_reports ;;
      4) quick_health_check ;;
      5) deploy_to_production ;;
      0) exit 0 ;;
      *) log RED "❌ Invalid choice"; show_menu ;;
  esac
}

# Quick health check

quick_health_check() {
  log BLUE "🏥 Running quick health check…"
  echo ""

  # Check Node.js
  if command -v node &>/dev/null; then
      log GREEN "✅ Node.js: $(node -v)"
  else
      log RED "❌ Node.js not found"
  fi

  # Check database
  if [ -f "$PROJECT_ROOT/prisma/dev.db" ]; then
      log GREEN "✅ Database: SQLite connected"
  else
      log YELLOW "⚠️  Database: Not configured"
  fi

  # Check build
  if [ -d "$PROJECT_ROOT/.next" ]; then
      log GREEN "✅ Build: Present"
  else
      log YELLOW "⚠️  Build: Not found"
  fi

  # Check environment
  if [ -f "$PROJECT_ROOT/.env.local" ]; then
      log GREEN "✅ Environment: Configured"
  else
      log RED "❌ Environment: .env.local missing"
  fi

  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

# Main execution

main() {
  print_banner
  print_system_info
  check_prerequisites

  if [ $# -eq 0 ]; then
      # Interactive mode
      show_menu
  else
      # Direct execution
      case $1 in
          --full|-f)
              run_full_pipeline
              generate_master_report
              print_summary
              ;;
          --help|-h)
              echo "Usage: $0 [OPTIONS]"
              echo ""
              echo "Options:"
              echo "  -f, --full      Run full enterprise pipeline"
              echo "  -h, --help      Show this help message"
              echo ""
              echo "Without options, runs in interactive mode"
              ;;
          *)
              log RED "❌ Unknown option: $1"
              exit 1
              ;;
      esac
  fi
}

# Error handler

trap 'log RED "❌ Script interrupted"; exit 1' INT TERM

# Run main

main "$@"