# 🚀 PR Submission Scripts

This directory contains automated scripts for submitting pull requests to GitHub for Gemini code review.

## 📋 Available Scripts

### 1. `submit-pr-for-gemini-review.sh` (Comprehensive)
**Full-featured script with detailed logging and error handling**

```bash
./scripts/submit-pr-for-gemini-review.sh
```

**Features:**
- ✅ Complete prerequisite validation
- ✅ GitHub CLI installation check
- ✅ Authentication verification
- ✅ Repository creation with conflict handling
- ✅ Branch pushing with error recovery
- ✅ PR creation with detailed description
- ✅ Automatic Gemini review request
- ✅ Comprehensive status reporting

### 2. `quick-pr-submit.sh` (Simplified)
**Fast execution for experienced users**

```bash
./scripts/quick-pr-submit.sh
```

**Features:**
- ⚡ Quick execution
- 🔧 Minimal error handling
- 📦 Basic repository creation
- 🤖 Automatic Gemini review request

## 🛠️ Prerequisites

### Required Tools
- **Git**: Version control
- **GitHub CLI**: `gh` command-line tool
- **Bash**: Shell environment

### Installation Commands

```bash
# Install GitHub CLI (macOS)
brew install gh

# Install GitHub CLI (Linux)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Install GitHub CLI (Windows)
winget install GitHub.cli
```

### Authentication
```bash
# Authenticate with GitHub
gh auth login

# Verify authentication
gh auth status
```

## 🚀 Usage

### Option 1: Comprehensive Script (Recommended)
```bash
# Make sure you're in the project root
cd /path/to/workspace-tools

# Run the comprehensive script
./scripts/submit-pr-for-gemini-review.sh
```

### Option 2: Quick Script
```bash
# Quick execution
./scripts/quick-pr-submit.sh
```

### Option 3: Manual Steps
If the scripts fail, you can run the commands manually:

```bash
# 1. Create repository
gh repo create jmbish04/worker-tools --public --description "Cloudflare Worker for Google Workspace integration with AI capabilities"

# 2. Push branches
git push -u origin main
git push -u origin feature/workspace-tools-implementation

# 3. Create PR
gh pr create --title "🚀 Cloudflare Workspace Tools Worker - Complete Implementation" --body-file PR_DESCRIPTION.md --base main --head feature/workspace-tools-implementation

# 4. Add Gemini review request
gh pr comment [PR_NUMBER] --body "🤖 @google-ai/gemini Please review this implementation..."
```

## 📊 What the Scripts Do

### 1. Repository Creation
- Creates public GitHub repository
- Sets up proper description and visibility
- Configures remote origin

### 2. Code Push
- Pushes main branch with all code
- Pushes feature branch for PR
- Sets up tracking branches

### 3. Pull Request Creation
- Creates PR with comprehensive description
- Sets proper base and head branches
- Includes all documentation

### 4. Gemini Review Request
- Adds detailed review request comment
- Tags @google-ai/gemini
- Provides context and focus areas

## 🔧 Configuration

### Repository Settings
- **Name**: `worker-tools`
- **Owner**: `jmbish04`
- **Visibility**: Public
- **Description**: "Cloudflare Worker for Google Workspace integration with AI capabilities"

### Branch Settings
- **Main Branch**: `main`
- **Feature Branch**: `feature/workspace-tools-implementation`

### PR Settings
- **Title**: "🚀 Cloudflare Workspace Tools Worker - Complete Implementation"
- **Description**: Uses `PR_DESCRIPTION.md`
- **Reviewer**: @google-ai/gemini

## 🚨 Troubleshooting

### Common Issues

1. **GitHub CLI not found**
   ```bash
   # Install GitHub CLI
   brew install gh  # macOS
   # or follow installation guide above
   ```

2. **Authentication required**
   ```bash
   # Authenticate
   gh auth login
   ```

3. **Repository already exists**
   - Script will detect and ask for confirmation
   - Choose 'y' to continue with existing repository

4. **Permission denied**
   ```bash
   # Make scripts executable
   chmod +x scripts/*.sh
   ```

5. **Git remote issues**
   ```bash
   # Check remote
   git remote -v
   
   # Add remote if missing
   git remote add origin https://github.com/jmbish04/worker-tools.git
   ```

### Debug Mode
```bash
# Run with debug output
bash -x scripts/submit-pr-for-gemini-review.sh
```

## 📈 Expected Output

### Successful Execution
```
🚀 Automated PR Submission for Gemini Code Review
================================
[INFO] Validating Prerequisites
[SUCCESS] All prerequisites validated!
[INFO] Creating GitHub Repository
[SUCCESS] Repository created successfully!
[INFO] Pushing Code to GitHub
[SUCCESS] Main branch pushed successfully!
[SUCCESS] Feature branch pushed successfully!
[INFO] Creating Pull Request
[SUCCESS] Pull request created successfully!
[INFO] Adding Gemini Code Review Request
[SUCCESS] Gemini review request added to PR #1!
🎉 PR Submission Complete!
✅ Repository: https://github.com/jmbish04/worker-tools
✅ Pull Request: https://github.com/jmbish04/worker-tools/pull/1
```

## 🔍 Verification

After running the script, verify:

1. **Repository exists**: https://github.com/jmbish04/worker-tools
2. **PR created**: Check the pull requests tab
3. **Gemini tagged**: Look for @google-ai/gemini in comments
4. **Code uploaded**: Verify all files are present

## 📝 Notes

- Scripts are idempotent (safe to run multiple times)
- Existing repositories and PRs are handled gracefully
- All sensitive data is excluded via .gitignore
- Comprehensive error handling and user feedback
- Detailed logging for troubleshooting
