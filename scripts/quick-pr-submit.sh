#!/bin/bash

# 🚀 Quick PR Submission Script
# Simplified version for rapid deployment

set -e

REPO_NAME="workspace-tools"
REPO_OWNER="jmbish04"
BRANCH_FEATURE="feature/workspace-tools-implementation"

echo "🚀 Quick PR Submission for Gemini Review"
echo "========================================"

# Check if GitHub CLI is installed
if ! command -v gh >/dev/null 2>&1; then
    echo "❌ GitHub CLI not found. Installing..."
    if command -v brew >/dev/null 2>&1; then
        brew install gh
    else
        echo "Please install GitHub CLI: https://cli.github.com/"
        exit 1
    fi
fi

# Check authentication
if ! gh auth status >/dev/null 2>&1; then
    echo "🔐 Please authenticate with GitHub:"
    gh auth login
fi

# Create repository (if it doesn't exist)
echo "📦 Creating repository..."
gh repo create "$REPO_OWNER/$REPO_NAME" --public --description "Cloudflare Worker for Google Workspace integration with AI capabilities" --source=. --remote=origin --push 2>/dev/null || echo "Repository already exists, continuing..."

# Push branches
echo "📤 Pushing code..."
git push -u origin main 2>/dev/null || true
git push -u origin "$BRANCH_FEATURE" 2>/dev/null || true

# Create PR
echo "🔀 Creating pull request..."
PR_URL=$(gh pr create --title "🚀 Cloudflare Workspace Tools Worker - Complete Implementation" --body-file PR_DESCRIPTION.md --base main --head "$BRANCH_FEATURE" 2>/dev/null || echo "PR already exists")

# Add Gemini review request
echo "🤖 Adding Gemini review request..."
PR_NUMBER=$(gh pr list --head "$BRANCH_FEATURE" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$PR_NUMBER" ]; then
    gh pr comment "$PR_NUMBER" --body "🤖 @google-ai/gemini Please review this comprehensive Cloudflare Worker implementation for code quality, security, performance, and Google Workspace integration best practices. Repository: $REPO_OWNER/$REPO_NAME, Branch: $BRANCH_FEATURE"
    echo "✅ PR #$PR_NUMBER created with Gemini review request!"
    echo "🔗 View PR: https://github.com/$REPO_OWNER/$REPO_NAME/pull/$PR_NUMBER"
else
    echo "⚠️  Could not create PR automatically. Please create manually."
fi

echo "🎉 Done! Check your GitHub repository for the PR."
