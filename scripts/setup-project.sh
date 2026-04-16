#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

# =============================================================================
# Quasar Template Project Setup Script
# =============================================================================
# Creates a complete project structure based on the standard multi-repo model.
#
# CREATED: In each quasar-template-* repo under scripts/
# USED BY: Developers after cloning a template to bootstrap their project
#
# Documentation: See docs/SETUP-PROJECT.md for full details
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Arrays to track what was created
declare -a CREATED_REPOS=()
declare -a REQUIRED_SECRETS=()

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

confirm() {
    local prompt="$1"
    local default="${2:-N}"

    if [[ "$default" == "Y" ]]; then
        read -p "$prompt (Y/n) " -n 1 -r
    else
        read -p "$prompt (y/N) " -n 1 -r
    fi
    echo ""

    if [[ "$default" == "Y" ]]; then
        [[ ! $REPLY =~ ^[Nn]$ ]]
    else
        [[ $REPLY =~ ^[Yy]$ ]]
    fi
}

select_option() {
    local prompt="$1"
    shift
    local options=("$@")

    echo "$prompt"
    for i in "${!options[@]}"; do
        echo "  [$((i+1))] ${options[$i]}"
    done

    local choice
    while true; do
        read -p "Enter choice [1-${#options[@]}]: " choice
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
            return $((choice-1))
        fi
        echo "Invalid choice. Please enter a number between 1 and ${#options[@]}."
    done
}

check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed."
        echo "Install it from: https://cli.github.com/"
        exit 1
    fi

    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI is not authenticated."
        echo "Run: gh auth login"
        exit 1
    fi
}

# =============================================================================
# Repository Creation Functions
# =============================================================================

create_repo() {
    local repo_name="$1"
    local visibility="$2"  # public or private
    local description="$3"

    print_step "Creating $repo_name ($visibility)..."

    if gh repo view "$repo_name" &>/dev/null; then
        print_warning "Repository $repo_name already exists, skipping creation"
        return 0
    fi

    gh repo create "$repo_name" \
        "--$visibility" \
        --description "$description" \
        --confirm

    CREATED_REPOS+=("$repo_name")
    print_success "Created $repo_name"
}

enable_security_features() {
    local repo="$1"

    print_step "Enabling security features for $repo..."

    # Enable secret scanning and push protection
    gh api "repos/$repo" --method PATCH \
        -f security_and_analysis.secret_scanning.status=enabled \
        -f security_and_analysis.secret_scanning_push_protection.status=enabled \
        2>/dev/null || print_warning "Could not enable secret scanning (may require admin)"

    # Enable vulnerability alerts
    gh api "repos/$repo/vulnerability-alerts" --method PUT 2>/dev/null || true

    # Enable automated security fixes
    gh api "repos/$repo/automated-security-fixes" --method PUT 2>/dev/null || true

    print_success "Security features enabled"
}

enable_discussions() {
    local repo="$1"

    print_step "Enabling Discussions for $repo..."
    gh api "repos/$repo" --method PATCH -F has_discussions=true 2>/dev/null || true
    print_success "Discussions enabled"
}

set_topics() {
    local repo="$1"
    shift
    local topics=("$@")

    print_step "Setting topics for $repo..."
    local topics_json=$(printf '%s\n' "${topics[@]}" | jq -R . | jq -s .)
    gh api "repos/$repo/topics" --method PUT -f names="$topics_json" 2>/dev/null || true
    print_success "Topics set"
}

# =============================================================================
# File Replacement Function
# =============================================================================

replace_placeholders() {
    print_step "Replacing placeholders in files..."

    local placeholders=(
        "{{PROJECT_NAME}}:$PROJECT_NAME"
        "{{PRODUCT_NAME}}:$PRODUCT_NAME"
        "{{PROJECT_DESCRIPTION}}:$PROJECT_DESCRIPTION"
        "{{AUTHOR_NAME}}:$AUTHOR_NAME"
        "{{AUTHOR_EMAIL}}:$AUTHOR_EMAIL"
        "{{APP_ID}}:$APP_ID"
        "{{GITHUB_ORG}}:$GITHUB_ORG"
        "{{SUPPORT_EMAIL}}:$SUPPORT_EMAIL"
    )

    for placeholder_pair in "${placeholders[@]}"; do
        local placeholder="${placeholder_pair%%:*}"
        local value="${placeholder_pair#*:}"

        find . -type f \( \
            -name "*.json" -o \
            -name "*.ts" -o \
            -name "*.vue" -o \
            -name "*.cjs" -o \
            -name "*.md" -o \
            -name "*.yml" -o \
            -name "*.yaml" -o \
            -name "*.sh" -o \
            -name "*.html" \
        \) -not -path "./node_modules/*" -not -path "./.git/*" | while read -r file; do
            if grep -q "$placeholder" "$file" 2>/dev/null; then
                sed -i "s|$placeholder|$value|g" "$file"
            fi
        done
    done

    print_success "Placeholders replaced"
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    print_header "Quasar Template Project Setup"

    echo "This script will:"
    echo "  1. Gather project information"
    echo "  2. Create GitHub repositories"
    echo "  3. Configure security and workflows"
    echo "  4. Replace template placeholders"
    echo ""

    # Check prerequisites
    check_gh_cli

    # =========================================================================
    # STEP 1: Basic Information
    # =========================================================================
    print_header "Step 1: Project Information"

    read -p "Project name (lowercase, no spaces, e.g., 'myapp'): " PROJECT_NAME
    read -p "Product name (display name, e.g., 'My App'): " PRODUCT_NAME
    read -p "Description: " PROJECT_DESCRIPTION
    read -p "Author name: " AUTHOR_NAME
    read -p "Author email: " AUTHOR_EMAIL
    read -p "Support email (for SECURITY.md): " SUPPORT_EMAIL
    read -p "App ID (e.g., com.company.app): " APP_ID

    # =========================================================================
    # STEP 2: Organization
    # =========================================================================
    print_header "Step 2: GitHub Organization"

    echo "Do you want to create a GitHub Organization for this project?"
    echo ""
    echo "  [1] Yes - MVP and Future Clients (creates wbd-${PROJECT_NAME} org)"
    echo "  [2] No  - MVP Only (use existing account/org)"
    echo ""

    read -p "Enter choice [1-2]: " ORG_CHOICE

    if [[ "$ORG_CHOICE" == "1" ]]; then
        GITHUB_ORG="wbd-${PROJECT_NAME}"
        echo ""
        print_warning "MANUAL STEP REQUIRED:"
        echo "  Create the organization at: https://github.com/organizations/new"
        echo "  Organization name: ${GITHUB_ORG}"
        echo ""
        read -p "Press Enter when the organization has been created..."

        # Verify org exists
        if ! gh api "orgs/$GITHUB_ORG" &>/dev/null; then
            print_error "Organization $GITHUB_ORG not found. Please create it first."
            exit 1
        fi
        print_success "Organization $GITHUB_ORG verified"
    else
        read -p "Enter existing GitHub org or username: " GITHUB_ORG
        if ! gh api "orgs/$GITHUB_ORG" &>/dev/null && ! gh api "users/$GITHUB_ORG" &>/dev/null; then
            print_error "Organization/user $GITHUB_ORG not found."
            exit 1
        fi
        print_success "Using $GITHUB_ORG"
    fi

    # =========================================================================
    # STEP 3: Production Repository
    # =========================================================================
    print_header "Step 3: Production Repository"

    PROD_OPTIONS=(
        "Private → Public (community/free version, synced from Dev)"
        "Private Premium (paid features, stays private)"
        "Private Enterprise (enterprise features, stays private)"
        "None (Dev repo only for now)"
    )

    select_option "What type of production repository?" "${PROD_OPTIONS[@]}"
    PROD_CHOICE=$?

    # =========================================================================
    # STEP 4: Plugins Repositories
    # =========================================================================
    print_header "Step 4: Plugins Repositories"

    PLUGIN_OPTIONS=(
        "Public plugins only (community ecosystem)"
        "Public + Premium plugins"
        "Premium plugins only"
        "None"
    )

    select_option "Create plugins repositories?" "${PLUGIN_OPTIONS[@]}"
    PLUGIN_CHOICE=$?

    # =========================================================================
    # STEP 5: Demo Environment
    # =========================================================================
    print_header "Step 5: Demo Environment"

    DEMO_OPTIONS=(
        "Private demo with login (authenticated playground)"
        "Public demo with login"
        "Public demo without login (static showcase)"
        "None"
    )

    select_option "Create demo environment?" "${DEMO_OPTIONS[@]}"
    DEMO_CHOICE=$?

    # =========================================================================
    # Summary and Confirmation
    # =========================================================================
    print_header "Configuration Summary"

    echo "Project Details:"
    echo "  Name:        $PROJECT_NAME"
    echo "  Product:     $PRODUCT_NAME"
    echo "  Description: $PROJECT_DESCRIPTION"
    echo "  Author:      $AUTHOR_NAME <$AUTHOR_EMAIL>"
    echo "  App ID:      $APP_ID"
    echo "  Org:         $GITHUB_ORG"
    echo ""

    echo "Repositories to create:"
    echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Dev (private) [ALWAYS]"

    case $PROD_CHOICE in
        0) echo "  • ${GITHUB_ORG}/${PROJECT_NAME} (private → public)" ;;
        1) echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Premium (private)" ;;
        2) echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Enterprise (private)" ;;
    esac

    case $PLUGIN_CHOICE in
        0) echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Plugins (public)" ;;
        1)
            echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Plugins (public)"
            echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium (private)"
            ;;
        2) echo "  • ${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium (private)" ;;
    esac

    case $DEMO_CHOICE in
        0) echo "  • ${PROJECT_NAME}-demo/${PROJECT_NAME}-demo.github.io (private demo)" ;;
        1) echo "  • ${PROJECT_NAME}-demo/${PROJECT_NAME}-demo.github.io (public demo w/ login)" ;;
        2) echo "  • ${PROJECT_NAME}-demo/${PROJECT_NAME}-demo.github.io (public demo static)" ;;
    esac

    echo ""

    if ! confirm "Proceed with setup?"; then
        echo "Cancelled."
        exit 0
    fi

    # =========================================================================
    # STEP 6: Execute
    # =========================================================================
    print_header "Creating Repositories"

    # Always create Dev repo
    create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Dev" "private" "${PRODUCT_NAME} - Development repository"
    enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Dev"

    # Required secrets for Dev
    REQUIRED_SECRETS+=("GIST_TOKEN - PAT with gist scope for CI badges")
    REQUIRED_SECRETS+=("TEST_BADGE_GIST_ID - Gist ID for test result badges")

    # Production repo
    case $PROD_CHOICE in
        0)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}" "private" "${PRODUCT_NAME} - ${PROJECT_DESCRIPTION}"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}"
            enable_discussions "${GITHUB_ORG}/${PROJECT_NAME}"
            set_topics "${GITHUB_ORG}/${PROJECT_NAME}" "quasar" "vue3" "typescript" "${PROJECT_NAME}"
            echo ""
            print_warning "NOTE: Run 'gh repo edit ${GITHUB_ORG}/${PROJECT_NAME} --visibility public' when ready to go public"
            ;;
        1)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Premium" "private" "${PRODUCT_NAME} Premium - ${PROJECT_DESCRIPTION}"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Premium"
            ;;
        2)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Enterprise" "private" "${PRODUCT_NAME} Enterprise - ${PROJECT_DESCRIPTION}"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Enterprise"
            ;;
    esac

    # Plugins repos
    case $PLUGIN_CHOICE in
        0)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Plugins" "public" "${PRODUCT_NAME} Plugins - Community plugin ecosystem"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Plugins"
            enable_discussions "${GITHUB_ORG}/${PROJECT_NAME}-Plugins"
            ;;
        1)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Plugins" "public" "${PRODUCT_NAME} Plugins - Community plugin ecosystem"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Plugins"
            enable_discussions "${GITHUB_ORG}/${PROJECT_NAME}-Plugins"
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium" "private" "${PRODUCT_NAME} Premium Plugins"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium"
            ;;
        2)
            create_repo "${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium" "private" "${PRODUCT_NAME} Premium Plugins"
            enable_security_features "${GITHUB_ORG}/${PROJECT_NAME}-Plugins-Premium"
            ;;
    esac

    # Demo environment
    case $DEMO_CHOICE in
        0|1|2)
            DEMO_VISIBILITY="public"
            [[ $DEMO_CHOICE == 0 ]] && DEMO_VISIBILITY="private"

            print_warning "Demo requires a separate GitHub account: ${PROJECT_NAME}-demo"
            echo "  Create at: https://github.com/signup"
            echo "  Then create a PAT with 'repo' and 'gist' scopes"
            echo ""

            REQUIRED_SECRETS+=("DEMO_GITHUB_TOKEN - PAT from ${PROJECT_NAME}-demo account")

            if [[ $DEMO_CHOICE != 2 ]]; then
                REQUIRED_SECRETS+=("VITE_DEMO_TOKEN_P1 - Split demo token part 1")
                REQUIRED_SECRETS+=("VITE_DEMO_TOKEN_P2 - Split demo token part 2")
                REQUIRED_SECRETS+=("VITE_HCAPTCHA_SITEKEY - hCaptcha site key for rate limiting")
            fi
            ;;
    esac

    # =========================================================================
    # Replace Placeholders
    # =========================================================================
    print_header "Configuring Local Files"

    replace_placeholders

    # =========================================================================
    # Final Summary
    # =========================================================================
    print_header "Setup Complete!"

    echo "Created repositories:"
    for repo in "${CREATED_REPOS[@]}"; do
        echo "  • https://github.com/$repo"
    done
    echo ""

    if [ ${#REQUIRED_SECRETS[@]} -gt 0 ]; then
        echo "Required secrets to configure in ${GITHUB_ORG}/${PROJECT_NAME}-Dev:"
        for secret in "${REQUIRED_SECRETS[@]}"; do
            echo "  • $secret"
        done
        echo ""
        echo "Add secrets at: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}-Dev/settings/secrets/actions"
        echo ""
    fi

    echo "Next steps:"
    echo "  1. cd into your project directory"
    echo "  2. npm install"
    echo "  3. npm run dev"
    echo "  4. Configure the required secrets listed above"
    echo "  5. Push your first commit"
    echo ""

    print_success "Happy coding!"
}

# Run main function
main "$@"
