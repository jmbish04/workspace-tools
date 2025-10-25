#!/bin/bash

# 🚀 Automated PR Submission for Gemini Code Review
# This script automates the process of creating a GitHub repository and submitting a PR

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_NAME="workspace-tools"
REPO_OWNER="jmbish04"
REPO_DESCRIPTION="Cloudflare Worker for Google Workspace integration with AI capabilities"
BRANCH_MAIN="main"
BRANCH_FEATURE="feature/workspace-tools-implementation"
PR_TITLE="🚀 Cloudflare Workspace Tools Worker - Complete Implementation"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if we're in a git repository
check_git_repo() {
    if [ ! -d ".git" ]; then
        print_error "Not in a git repository. Please run this script from the project root."
        exit 1
    fi
}

# Function to check if GitHub CLI is installed
check_gh_cli() {
    if ! command_exists gh; then
        print_warning "GitHub CLI (gh) not found. Installing via Homebrew..."
        if command_exists brew; then
            brew install gh
        else
            print_error "Homebrew not found. Please install GitHub CLI manually:"
            print_error "Visit: https://cli.github.com/"
            exit 1
        fi
    fi
}

# Function to check GitHub CLI authentication
check_gh_auth() {
    if ! gh auth status >/dev/null 2>&1; then
        print_warning "GitHub CLI not authenticated. Please authenticate:"
        gh auth login
    fi
}

# Function to create the repository
create_repository() {
    print_header "Creating GitHub Repository"
    
    # Check if repository already exists
    if gh repo view "$REPO_OWNER/$REPO_NAME" >/dev/null 2>&1; then
        print_warning "Repository $REPO_OWNER/$REPO_NAME already exists."
        read -p "Do you want to continue with the existing repository? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Aborted by user."
            exit 1
        fi
    else
        print_status "Creating repository: $REPO_OWNER/$REPO_NAME"
        gh repo create "$REPO_OWNER/$REPO_NAME" \
            --public \
            --description "$REPO_DESCRIPTION" \
            --source=. \
            --remote=origin \
            --push
        print_success "Repository created successfully!"
    fi
}

# Function to push branches
push_branches() {
    print_header "Pushing Code to GitHub"
    
    # Add remote if it doesn't exist
    if ! git remote get-url origin >/dev/null 2>&1; then
        print_status "Adding remote origin..."
        git remote add origin "https://github.com/$REPO_OWNER/$REPO_NAME.git"
    fi
    
    # Push main branch
    print_status "Pushing main branch..."
    git checkout "$BRANCH_MAIN"
    git push -u origin "$BRANCH_MAIN"
    print_success "Main branch pushed successfully!"
    
    # Push feature branch
    print_status "Pushing feature branch..."
    git checkout "$BRANCH_FEATURE"
    git push -u origin "$BRANCH_FEATURE"
    print_success "Feature branch pushed successfully!"
}

# Function to create pull request
create_pull_request() {
    print_header "Creating Pull Request"
    
    # Check if PR already exists
    if gh pr list --repo "$REPO_OWNER/$REPO_NAME" --head "$BRANCH_FEATURE" --json number --jq '.[0].number' >/dev/null 2>&1; then
        print_warning "Pull request already exists for this branch."
        return 0
    fi
    
    # Create PR with the description file
    print_status "Creating pull request..."
    gh pr create \
        --repo "$REPO_OWNER/$REPO_NAME" \
        --title "$PR_TITLE" \
        --body-file "PR_DESCRIPTION.md" \
        --base "$BRANCH_MAIN" \
        --head "$BRANCH_FEATURE"
    
    print_success "Pull request created successfully!"
}

# Function to add Gemini review request
add_gemini_review_request() {
    print_header "Adding Gemini Code Review Request"
    
    # Get the PR number
    PR_NUMBER=$(gh pr list --repo "$REPO_OWNER/$REPO_NAME" --head "$BRANCH_FEATURE" --json number --jq '.[0].number')
    
    if [ -n "$PR_NUMBER" ]; then
        print_status "Adding Gemini review request to PR #$PR_NUMBER..."
        
        # Create a comment with the Gemini review request
        cat > /tmp/gemini_review_request.md << EOF
## 🤖 Gemini Code Review Request

@google-ai/gemini Please review this comprehensive Cloudflare Worker implementation for:

### 🔍 Review Focus Areas

1. **Code Quality**: TypeScript best practices, error handling, type safety
2. **Security**: Authentication, input validation, data protection
3. **Performance**: Caching, connection pooling, database optimization
4. **Architecture**: Modular design, scalability, maintainability
5. **Google Workspace Integration**: API usage, error handling, best practices
6. **AI Provider Integration**: Multi-provider support, fallback strategies
7. **A2A Protocol**: Agent-to-agent communication implementation

### 🎯 Key Areas of Focus
- Security vulnerabilities or data exposure risks
- Performance bottlenecks or optimization opportunities
- Code maintainability and extensibility
- Google API integration best practices
- Error handling and edge cases
- TypeScript type safety improvements
- Cloudflare Workers best practices

### 📊 Repository Information
- **Repository**: $REPO_OWNER/$REPO_NAME
- **Branch**: $BRANCH_FEATURE
- **Files Changed**: 119 files, 39,173+ insertions
- **TypeScript**: Full type safety with zero compilation errors
- **Testing**: Comprehensive test suite included
- **Documentation**: Complete API and setup documentation

### 🚀 Features Implemented
- Google Workspace integration (Gmail, Drive, Docs, Sheets, Slides)
- Multi-provider AI support (OpenAI, Gemini, Anthropic, Workers AI)
- A2A (Agent-to-Agent) communication protocol
- Advanced email analysis and spam detection
- D1 database logging with verbosity levels
- Rate limiting and security measures
- Comprehensive error handling and validation

Please provide detailed feedback on code quality, security, performance, and architectural decisions.
EOF
        
        # Add the comment to the PR
        gh pr comment "$PR_NUMBER" --repo "$REPO_OWNER/$REPO_NAME" --body-file /tmp/gemini_review_request.md
        
        print_success "Gemini review request added to PR #$PR_NUMBER!"
        
        # Clean up temporary file
        rm -f /tmp/gemini_review_request.md
    else
        print_error "Could not find PR number. Please add the Gemini review request manually."
    fi
}

# Function to display final information
display_final_info() {
    print_header "🎉 PR Submission Complete!"
    
    echo -e "${GREEN}✅ Repository:${NC} https://github.com/$REPO_OWNER/$REPO_NAME"
    echo -e "${GREEN}✅ Pull Request:${NC} https://github.com/$REPO_OWNER/$REPO_NAME/pull/$PR_NUMBER"
    echo -e "${GREEN}✅ Feature Branch:${NC} $BRANCH_FEATURE"
    echo -e "${GREEN}✅ Main Branch:${NC} $BRANCH_MAIN"
    
    echo
    print_status "Next Steps:"
    echo "1. Wait for Gemini to review the code"
    echo "2. Address any feedback or suggestions"
    echo "3. Merge the PR when approved"
    echo "4. Deploy to production"
    
    echo
    print_status "To monitor the PR:"
    echo "gh pr view $PR_NUMBER --repo $REPO_OWNER/$REPO_NAME"
    
    echo
    print_status "To check PR status:"
    echo "gh pr status --repo $REPO_OWNER/$REPO_NAME"
}

# Function to validate prerequisites
validate_prerequisites() {
    print_header "Validating Prerequisites"
    
    # Check if we're in a git repository
    check_git_repo
    
    # Check if GitHub CLI is installed
    check_gh_cli
    
    # Check GitHub CLI authentication
    check_gh_auth
    
    # Check if PR_DESCRIPTION.md exists
    if [ ! -f "PR_DESCRIPTION.md" ]; then
        print_error "PR_DESCRIPTION.md not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check if we're on the correct branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "$BRANCH_FEATURE" ]; then
        print_warning "Not on feature branch. Switching to $BRANCH_FEATURE..."
        git checkout "$BRANCH_FEATURE"
    fi
    
    print_success "All prerequisites validated!"
}

# Main execution
main() {
    print_header "🚀 Automated PR Submission for Gemini Code Review"
    
    # Validate prerequisites
    validate_prerequisites
    
    # Create repository
    create_repository
    
    # Push branches
    push_branches
    
    # Create pull request
    create_pull_request
    
    # Add Gemini review request
    add_gemini_review_request
    
    # Display final information
    display_final_info
}

# Run main function
main "$@"
