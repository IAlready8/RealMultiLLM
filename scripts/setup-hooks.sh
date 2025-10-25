#!/bin/bash
# Git hooks setup script
# Run this once to install git hooks

set -e

echo "🔧 Setting up Git hooks..."
echo "=========================="

# Get the repository root
REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.githooks"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Check if .githooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ .githooks directory not found!"
    exit 1
fi

# Make all hook scripts executable
chmod +x "$HOOKS_DIR"/*

echo "📝 Installing hooks..."

# Install pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
    ln -sf "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    echo "✓ Installed pre-commit hook"
fi

# Install pre-push hook
if [ -f "$HOOKS_DIR/pre-push" ]; then
    ln -sf "$HOOKS_DIR/pre-push" "$GIT_HOOKS_DIR/pre-push"
    echo "✓ Installed pre-push hook"
fi

# Configure git to use .githooks directory
git config core.hooksPath "$HOOKS_DIR"

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "📋 Installed hooks:"
echo "  • pre-commit: Type check, lint, unit tests"
echo "  • pre-push: Full test suite + build"
echo ""
echo "🚀 Your commits will now be validated automatically!"
echo ""
echo "To bypass hooks (NOT RECOMMENDED):"
echo "  • git commit --no-verify"
echo "  • git push --no-verify"
