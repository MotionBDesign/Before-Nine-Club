#!/bin/bash
#
# Build the tracker and stage a self-contained install bundle onto the studio
# file server. Run this on ONE Mac (needs Xcode command line tools); everyone
# else installs from the staged copy with no build step.
#
#   ./scripts/stage-release.sh "/Volumes/MBD Server/Software/TimeTracker"
#
# The destination gets:
#   MBDTimeTracker-<version>/   the bundle (code + prebuilt observer + installer)
#   LATEST                      a text file naming the current bundle directory
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:?Usage: stage-release.sh /path/to/server/folder}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mError:\033[0m %s\n\n' "$*" >&2; exit 1; }

[[ -d "$DEST" ]] || die "Destination $DEST does not exist. Is the server mounted?"

# MBD_TT_OBSERVER_BIN overrides the build for testing on non-Mac machines.
OBSERVER_BIN="${MBD_TT_OBSERVER_BIN:-}"
if [[ -z "$OBSERVER_BIN" ]]; then
  [[ "$(uname -s)" == "Darwin" ]] || die "The observer can only be built on macOS."
  command -v swift >/dev/null || die "Swift is not available. Install the Xcode command line tools: xcode-select --install"
  say "Building the observer"
  ( cd "$REPO/observer" && swift build -c release )
  OBSERVER_BIN="$REPO/observer/.build/release/BNObserver"
fi
[[ -f "$OBSERVER_BIN" ]] || die "Observer binary not found at $OBSERVER_BIN"

VERSION="$(date +%Y%m%d)-$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo local)"
STAGE="$DEST/MBDTimeTracker-$VERSION"

say "Staging $VERSION to $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE/observer" "$STAGE/scripts"

# The daemon ships as source — Node runs the TypeScript directly, no build.
# node_modules is dev-only (typescript, @types) and deliberately excluded.
mkdir -p "$STAGE/daemon"
cp -R "$REPO/daemon/src" "$STAGE/daemon/src"
cp -R "$REPO/daemon/test" "$STAGE/daemon/test"
mkdir -p "$STAGE/daemon/scripts"
cp "$REPO/daemon/scripts/demo.ts" "$STAGE/daemon/scripts/demo.ts"
cp "$REPO/daemon/package.json" "$STAGE/daemon/package.json"

cp -R "$REPO/config" "$STAGE/config"
cp "$REPO/scripts/install.sh" "$STAGE/scripts/install.sh"
cp "$REPO/scripts/com.motionbydesign.timetracker.plist.template" "$STAGE/scripts/"
cp "$REPO/scripts/com.motionbydesign.timetracker.observer.plist.template" "$STAGE/scripts/"
cp "$REPO/README.md" "$STAGE/README.md"

cp "$OBSERVER_BIN" "$STAGE/observer/BNObserver"
chmod +x "$STAGE/observer/BNObserver" "$STAGE/scripts/install.sh"

# The marker file is what switches install.sh into bundle mode.
echo "$VERSION" > "$STAGE/BUNDLE"

# SMB shares handle symlinks unreliably, so LATEST is a plain text pointer.
echo "MBDTimeTracker-$VERSION" > "$DEST/LATEST"

say "Done"
note "Staged: $STAGE"
note ""
note "Tell the team: open the server folder, then run"
note "  cd \"$STAGE\" && ./scripts/install.sh"
