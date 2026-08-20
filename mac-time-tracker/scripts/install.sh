#!/bin/bash
#
# Install the time tracker as a login-time background agent.
#
#   ./scripts/install.sh              full install
#   ./scripts/install.sh --uninstall  stop and remove the agent (keeps your data)
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.motionbydesign.timetracker"
OBSERVER_LABEL="$LABEL.observer"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
OBSERVER_PLIST="$HOME/Library/LaunchAgents/$OBSERVER_LABEL.plist"
DATA_DIR="$HOME/Library/Application Support/MBDTimeTracker"
SPOOL="$DATA_DIR/observer.ndjson"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mError:\033[0m %s\n\n' "$*" >&2; exit 1; }

unload_agents() {
  launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
  launchctl bootout "gui/$UID/$OBSERVER_LABEL" 2>/dev/null || true
}

if [[ "${1:-}" == "--uninstall" ]]; then
  say "Removing the time tracker agents"
  unload_agents
  rm -f "$PLIST" "$OBSERVER_PLIST"
  note "Agent removed. Your data is untouched in:"
  note "$DATA_DIR"
  note "Delete it by hand if you want it gone."
  exit 0
fi

[[ "$(uname -s)" == "Darwin" ]] || die "This tracker only runs on macOS."

say "1. Checking prerequisites"

command -v node >/dev/null || die "Node is not installed. Install Node 22.18 or newer (brew install node)."
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if (( NODE_MAJOR < 22 || (NODE_MAJOR == 22 && NODE_MINOR < 18) )); then
  die "Node $(node -v) is too old. The daemon runs TypeScript directly, which needs 22.18 or newer."
fi
note "Node $(node -v) at $NODE_BIN"

command -v swift >/dev/null || die "Swift is not available. Install the Xcode command line tools: xcode-select --install"
note "Swift $(swift --version 2>/dev/null | head -1)"

say "2. Building the observer"
( cd "$REPO/observer" && swift build -c release )
OBSERVER="$REPO/observer/.build/release/BNObserver"
[[ -x "$OBSERVER" ]] || die "Build finished but $OBSERVER is missing."
note "Built $OBSERVER"

say "3. Setting up the data directory"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
node "$REPO/daemon/src/cli.ts" init

say "4. ClickUp token"
if security find-generic-password -s mbd-time-tracker -a clickup-api-token -w >/dev/null 2>&1; then
  note "A token is already in your keychain; leaving it alone."
else
  note "Create a personal token at ClickUp > Settings > Apps > API Token."
  printf '  Paste it here (input hidden, blank to skip): '
  read -rs TOKEN
  printf '\n'
  if [[ -n "$TOKEN" ]]; then
    security add-generic-password -s mbd-time-tracker -a clickup-api-token -w "$TOKEN" -U
    note "Stored in your login keychain."
  else
    note "Skipped. Matching will work offline, but nothing can be pushed until you add one."
  fi
fi

say "5. Caching your ClickUp workspace"
if security find-generic-password -s mbd-time-tracker -a clickup-api-token -w >/dev/null 2>&1; then
  node "$REPO/daemon/src/cli.ts" catalog || note "Catalog refresh failed; run it again after editing config.json."
else
  note "No token, skipping."
fi

say "6. Installing the launch agents"
mkdir -p "$HOME/Library/LaunchAgents"

# Two agents on purpose. The observer must be started by launchd directly, or
# macOS attributes its Accessibility permission to whatever spawned it.
# Keep the agent's flags in step with config.json rather than duplicating the
# default here; fall back if the file is missing or malformed.
BROWSER_URLS="$(node -e '
  try {
    const c = require(process.argv[1]);
    process.stdout.write(c?.observer?.browserUrls ?? "accessibility");
  } catch { process.stdout.write("accessibility"); }
' "$DATA_DIR/config.json" 2>/dev/null || echo accessibility)"
note "Browser URL mode: $BROWSER_URLS"

sed -e "s|__OBSERVER__|$OBSERVER|g" \
    -e "s|__SPOOL__|$SPOOL|g" \
    -e "s|__BROWSER_URLS__|$BROWSER_URLS|g" \
    -e "s|__HOME__|$HOME|g" \
    "$REPO/scripts/$OBSERVER_LABEL.plist.template" > "$OBSERVER_PLIST"

sed -e "s|__NODE__|$NODE_BIN|g" \
    -e "s|__REPO__|$REPO|g" \
    -e "s|__HOME__|$HOME|g" \
    "$REPO/scripts/$LABEL.plist.template" > "$PLIST"

unload_agents
launchctl bootstrap "gui/$UID" "$OBSERVER_PLIST"
launchctl bootstrap "gui/$UID" "$PLIST"
note "Loaded $OBSERVER_LABEL and $LABEL"

say "Done"
cat <<NEXT
  The tracker starts at login and runs in the background.

  One manual step remains: macOS will not let the observer read window titles
  or open file paths until you grant Accessibility permission.

    System Settings > Privacy & Security > Accessibility

  Add this binary with the "+" button:
    $OBSERVER

  If the list will not accept it, press Cmd-Shift-G in the file picker and
  paste that path. Then restart the agent:

    launchctl kickstart -k gui/$UID/$OBSERVER_LABEL

  Everyday commands:
    open http://127.0.0.1:7878/            review and approve the day
    node daemon/src/cli.ts report          same thing in the terminal
    node daemon/src/cli.ts doctor          check the setup
    ./scripts/install.sh --uninstall       stop tracking

  Until that permission is granted the tracker still records which app is in
  front, but window titles and file paths stay blank -- which is most of what
  the matching relies on, so do not skip it.

  Logs: ~/Library/Logs/mbd-time-tracker.{out,err}.log
        ~/Library/Logs/mbd-time-tracker.observer.log
NEXT
