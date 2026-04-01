#!/usr/bin/env bash
set -euo pipefail

REPO="rolandmarg/lorebook"
INSTALL_DIR="${HOME}/.local/bin"
CLAUDE_DIR="${HOME}/.claude"
LOREBOOK_DIR="${CLAUDE_DIR}/lorebook"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}${BOLD}==>${NC} ${BOLD}$1${NC}"; }
warn()  { echo -e "${YELLOW}warning:${NC} $1"; }
error() { echo -e "${RED}error:${NC} $1" >&2; exit 1; }

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  *)       error "Unsupported OS: $OS" ;;
esac

# Detect arch
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
  *)       error "Unsupported architecture: $ARCH" ;;
esac

BINARY="lorebook-${PLATFORM}-${ARCH}"
info "Detected platform: ${PLATFORM}-${ARCH}"

# Download binary
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST" ]; then
  error "Could not determine latest release"
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"
info "Downloading lorebook ${LATEST}..."

mkdir -p "$INSTALL_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/lorebook"
chmod +x "${INSTALL_DIR}/lorebook"

info "Installed to ${INSTALL_DIR}/lorebook"

# Check PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "^${INSTALL_DIR}$"; then
  warn "${INSTALL_DIR} is not in your PATH"
  warn "Add this to your shell profile: export PATH=\"${INSTALL_DIR}:\$PATH\""
fi

# Detect and configure Claude Code
if [ -d "$CLAUDE_DIR" ]; then
  info "Claude Code detected — configuring hook..."

  SETTINGS_FILE="${CLAUDE_DIR}/settings.json"

  HOOK_ENTRY='{"type":"command","command":"lorebook match"}'
  HOOK_GROUP="{\"hooks\":[${HOOK_ENTRY}]}"

  if [ -f "$SETTINGS_FILE" ]; then
    if grep -q "lorebook match" "$SETTINGS_FILE" 2>/dev/null; then
      info "Hook already configured — skipping"
    else
      TEMP=$(mktemp)
      if command -v python3 &>/dev/null; then
        python3 -c "
import json, sys
with open('${SETTINGS_FILE}') as f:
    settings = json.load(f)
hooks = settings.setdefault('hooks', {})
ups = hooks.setdefault('UserPromptSubmit', [])
ups.append(json.loads('${HOOK_GROUP}'))
with open('${TEMP}', 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')
"
        mv "$TEMP" "$SETTINGS_FILE"
        info "Added UserPromptSubmit hook to ${SETTINGS_FILE}"
      else
        warn "Could not find python3 to merge settings — add hook manually"
        warn "See: https://github.com/${REPO}#manual-setup"
      fi
    fi
  else
    cat > "$SETTINGS_FILE" << 'SETTINGS_EOF'
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "lorebook match"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF
    info "Created ${SETTINGS_FILE} with lorebook hook"
  fi

  if [ ! -d "$LOREBOOK_DIR" ]; then
    mkdir -p "$LOREBOOK_DIR"
    cat > "${LOREBOOK_DIR}/example.md" << 'EXAMPLE_EOF'
---
keys: [example, demo]
priority: 0
enabled: false
description: Example lorebook entry — enable and customize this, or delete it and create your own
---

This is an example lorebook entry. When enabled, it injects this content into your prompt whenever you mention "example" or "demo".

Create your own entries as .md files in this directory with YAML frontmatter containing keys, priority, and other fields. See https://github.com/rolandmarg/lorebook for documentation.
EXAMPLE_EOF
    info "Created ${LOREBOOK_DIR}/ with example entry"
  else
    info "Lorebook directory already exists — skipping"
  fi
else
  warn "Claude Code not detected (~/.claude/ not found)"
  warn "Install Claude Code first, then re-run this script to configure the hook"
fi

echo ""
info "lorebook ${LATEST} installed successfully!"
echo ""
echo "  Next steps:"
echo "    1. Create entries in ~/.claude/lorebook/ or .claude/lorebook/"
echo "    2. Test with: lorebook test \"your prompt here\""
echo "    3. See all entries: lorebook list"
echo ""
