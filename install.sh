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

BASE_URL="https://github.com/${REPO}/releases/download/${LATEST}"
info "Downloading lorebook ${LATEST}..."

mkdir -p "$INSTALL_DIR"
TEMP_DIR=$(mktemp -d)
curl -fsSL "${BASE_URL}/${BINARY}" -o "${TEMP_DIR}/lorebook"
curl -fsSL "${BASE_URL}/SHA256SUMS" -o "${TEMP_DIR}/SHA256SUMS"

# Verify checksum
EXPECTED=$(grep "${BINARY}" "${TEMP_DIR}/SHA256SUMS" | awk '{print $1}')
ACTUAL=$(sha256sum "${TEMP_DIR}/lorebook" | awk '{print $1}')
if [ "$EXPECTED" != "$ACTUAL" ]; then
  rm -rf "$TEMP_DIR"
  error "Checksum verification failed — download may be corrupted or tampered with"
fi

mv "${TEMP_DIR}/lorebook" "${INSTALL_DIR}/lorebook"
chmod +x "${INSTALL_DIR}/lorebook"
rm -rf "$TEMP_DIR"

info "Installed to ${INSTALL_DIR}/lorebook (checksum verified)"

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
        SETTINGS_PATH="$SETTINGS_FILE" TEMP_OUT="$TEMP" HOOK_JSON="$HOOK_GROUP" python3 << 'PYEOF'
import json, os
settings_path = os.environ['SETTINGS_PATH']
temp_out = os.environ['TEMP_OUT']
hook_json = os.environ['HOOK_JSON']
with open(settings_path) as f:
    settings = json.load(f)
hooks = settings.setdefault('hooks', {})
ups = hooks.setdefault('UserPromptSubmit', [])
ups.append(json.loads(hook_json))
with open(temp_out, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')
PYEOF
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
    cat > "${LOREBOOK_DIR}/lorebook.md" << 'LOREBOOK_EOF'
---
keys: [lorebook]
---

Lorebook injects context into prompts when keywords match. Entries are .md files in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global).

Frontmatter: `keys` (required, triggers on ANY match), `exclude_keys` (suppresses on ANY match), `priority` (higher = first), `enabled` (default true). Matching is case-insensitive with word boundaries.

Multiple matches are sorted by priority, capped at 5 entries / 4000 chars. Verify with `lorebook test "prompt"`, list with `lorebook list`. https://github.com/rolandmarg/lorebook
LOREBOOK_EOF
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
