#!/bin/bash
#
# Install the time tracker as a login-time background agent.
#
#   ./scripts/install.sh              full install
#   ./scripts/install.sh --uninstall  stop and remove the agent (keeps your data)
#
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.motionbydesign.timetracker"
OBSERVER_LABEL="$LABEL.observer"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
OBSERVER_PLIST="$HOME/Library/LaunchAgents/$OBSERVER_LABEL.plist"
DATA_DIR="$HOME/Library/Application Support/MBDTimeTracker"
SPOOL="$DATA_DIR/observer.ndjson"

# The tracker always *runs* from local disk, even when installed from the file
# server. A network volume is not safe to run from: macOS ties the
# Accessibility grant to the binary (so a share update silently revokes it),
# and launchd starts the agents at login, often before the share is mounted.
APP_DIR="$DATA_DIR/app"
REPO="$APP_DIR"

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
  rm -rf "$APP_DIR"
  note "Agents and the installed program are removed. Your data is untouched in:"
  note "$DATA_DIR"
  note "Delete it by hand if you want it gone."
  exit 0
fi

[[ "$(uname -s)" == "Darwin" ]] || die "This tracker only runs on macOS."
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"

say "1. Checking prerequisites"

# Node is what runs the tracker itself. Rather than making every person
# install it, fetch a private copy into our own data directory when the Mac
# does not already have a new enough one. Nothing system-wide is touched, no
# admin password is needed, and uninstalling is a matter of deleting a folder.
NODE_VERSION="v22.23.2"
NODE_HOME="$DATA_DIR/runtime/node-$NODE_VERSION"

node_is_recent_enough() {
  local candidate="$1"
  [[ -x "$candidate" ]] || return 1
  local major minor
  major="$("$candidate" -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || return 1
  minor="$("$candidate" -p 'process.versions.node.split(".")[1]' 2>/dev/null)" || return 1
  (( major > 22 || (major == 22 && minor >= 18) ))
}

install_private_node() {
  local arch tarball url expected actual staging
  case "$(uname -m)" in
    arm64) arch="darwin-arm64" ;;
    x86_64) arch="darwin-x64" ;;
    *) die "Unsupported processor: $(uname -m)" ;;
  esac
  tarball="node-$NODE_VERSION-$arch.tar.gz"
  staging="$(mktemp -d)"

  # An offline copy shipped inside the package wins; otherwise fetch it.
  if [[ -f "$REPO/runtime/$tarball" ]]; then
    note "Using the copy of Node included in this package."
    cp "$REPO/runtime/$tarball" "$staging/$tarball"
  else
    url="https://nodejs.org/dist/$NODE_VERSION/$tarball"
    note "Downloading Node $NODE_VERSION (about 50 MB, one time)..."
    curl -fL --progress-bar -o "$staging/$tarball" "$url" \
      || die "Could not download Node. Check the internet connection and try again."

    # Verify against the published checksum before running any of it.
    expected="$(curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" 2>/dev/null | awk -v f="$tarball" '$2 == f { print $1 }')"
    if [[ -n "$expected" ]]; then
      actual="$(shasum -a 256 "$staging/$tarball" | awk '{ print $1 }')"
      [[ "$actual" == "$expected" ]] || die "The downloaded Node did not match its published checksum. Nothing was installed."
      note "Checksum verified."
    else
      note "Could not fetch the checksum list; continuing without verification."
    fi
  fi

  mkdir -p "$NODE_HOME"
  tar -xzf "$staging/$tarball" -C "$NODE_HOME" --strip-components=1 \
    || die "Could not unpack Node."
  rm -rf "$staging"
}

NODE_BIN=""
if node_is_recent_enough "$(command -v node 2>/dev/null || true)"; then
  NODE_BIN="$(command -v node)"
  note "Using the Node already on this Mac: $("$NODE_BIN" -v)"
elif node_is_recent_enough "$NODE_HOME/bin/node"; then
  NODE_BIN="$NODE_HOME/bin/node"
  note "Using the private copy of Node from a previous install."
else
  install_private_node
  NODE_BIN="$NODE_HOME/bin/node"
  node_is_recent_enough "$NODE_BIN" || die "The Node install did not work. Tell Dom what this printed."
  note "Installed Node $("$NODE_BIN" -v) just for the tracker."
fi

# A staged bundle from the file server carries a prebuilt observer, so most
# people never need Xcode. Only a source checkout has to compile.
BUNDLED=0
[[ -f "$SOURCE/BUNDLE" ]] && BUNDLED=1

if (( BUNDLED )); then
  note "Installing bundle $(cat "$SOURCE/BUNDLE") from $SOURCE"
else
  if ! command -v swift >/dev/null; then
    printf '\n'
    note "This package has no prebuilt helper, so it has to be compiled here,"
    note "which needs Apple's developer tools."
    note ""
    note "Run this, let it finish (it is a big download), then run the"
    note "installer again:"
    note ""
    note "    xcode-select --install"
    note ""
    note "Only one Mac ever needs to do this — once Dom has built it, everyone"
    note "else installs a ready-made copy with no developer tools at all."
    die "Developer tools are not installed yet."
  fi
  note "Swift $(swift --version 2>/dev/null | head -1)"
fi

say "2. Copying the program to this Mac"
# Stop anything already running before its own source is replaced underneath
# it. Also releases the daemon's instance lock cleanly.
unload_agents
# Copy first, then work only from the local copy — nothing below touches the
# share again, so the tracker keeps running when the server is unmounted.
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR.new"
mkdir -p "$APP_DIR.new"
for item in daemon config scripts observer README.md BUNDLE; do
  [[ -e "$SOURCE/$item" ]] && cp -R "$SOURCE/$item" "$APP_DIR.new/"
done
# Never carry a stale build or dev dependencies across.
rm -rf "$APP_DIR.new/observer/.build" "$APP_DIR.new/daemon/node_modules"
rm -rf "$APP_DIR.old"
[[ -d "$APP_DIR" ]] && mv "$APP_DIR" "$APP_DIR.old"
mv "$APP_DIR.new" "$APP_DIR"
rm -rf "$APP_DIR.old"
chmod -R u+rwX "$APP_DIR"
note "Installed to $APP_DIR"

say "3. Preparing the observer"
if (( BUNDLED )); then
  OBSERVER="$APP_DIR/observer/BNObserver"
  [[ -f "$OBSERVER" ]] || die "The bundle is missing $OBSERVER"
  chmod +x "$OBSERVER"
  # Files copied from a network share can carry a quarantine flag; clearing it
  # avoids a Gatekeeper prompt the first time launchd starts the observer.
  xattr -d com.apple.quarantine "$OBSERVER" 2>/dev/null || true
  note "Using the prebuilt observer (no Xcode needed)"
else
  ( cd "$APP_DIR/observer" && swift build -c release )
  OBSERVER="$APP_DIR/observer/.build/release/BNObserver"
  [[ -x "$OBSERVER" ]] || die "Build finished but $OBSERVER is missing."
  note "Built $OBSERVER"
fi

say "4. Setting up the data directory"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
"$NODE_BIN" "$REPO/daemon/src/cli.ts" init

say "5. ClickUp token"
if security find-generic-password -s mbd-time-tracker -a clickup-api-token -w >/dev/null 2>&1; then
  note "A token is already in your keychain; leaving it alone."
else
  note "Create a personal token at ClickUp > Settings > Apps > API Token."
  TOKEN=""
  if [[ -n "${MBD_TT_UNATTENDED:-}" ]]; then
    note "Unattended update; leaving the existing token alone."
  elif [[ -t 0 ]]; then
    printf '  Paste it here (input hidden, blank to skip): '
    # `read` returns non-zero at EOF, which would abort the whole install
    # under `set -e` — never let a blank answer kill the run.
    read -rs TOKEN || true
    printf '\n'
  else
    note "Not running interactively; skipping the prompt."
  fi
  if [[ -n "$TOKEN" ]]; then
    security add-generic-password -s mbd-time-tracker -a clickup-api-token -w "$TOKEN" -U
    note "Stored in your login keychain."
  else
    note "Skipped. Matching works offline, but nothing can be pushed until you add one:"
    note "  security add-generic-password -s mbd-time-tracker -a clickup-api-token -w '<token>' -U"
  fi
fi

say "6. Caching your ClickUp workspace"
if security find-generic-password -s mbd-time-tracker -a clickup-api-token -w >/dev/null 2>&1; then
  "$NODE_BIN" "$REPO/daemon/src/cli.ts" catalog || note "Catalog refresh failed; run it again after editing config.json."
else
  note "No token, skipping."
fi

say "7. Adding a launcher"
cat > "$DATA_DIR/tracker" <<LAUNCHER
#!/bin/bash
# Runs the tracker's commands with whichever Node the installer settled on,
# so none of them depend on Node being on the PATH.
exec "$NODE_BIN" "$REPO/daemon/src/cli.ts" "\$@"
LAUNCHER
chmod +x "$DATA_DIR/tracker"
note "Created $DATA_DIR/tracker"

say "8. Installing the launch agents"
mkdir -p "$HOME/Library/LaunchAgents"

# Two agents on purpose. The observer must be started by launchd directly, or
# macOS attributes its Accessibility permission to whatever spawned it.
# Keep the agent's flags in step with config.json rather than duplicating the
# default here; fall back if the file is missing or malformed.
BROWSER_URLS="$("$NODE_BIN" -e '
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
    "$DATA_DIR/tracker" report             same thing in the terminal
    "$DATA_DIR/tracker" doctor             check the setup
    "$DATA_DIR/tracker" probe              see what each app reports
    ./scripts/install.sh --uninstall       stop tracking

  Until that permission is granted the tracker still records which app is in
  front, but window titles and file paths stay blank -- which is most of what
  the matching relies on, so do not skip it.

  Logs: ~/Library/Logs/mbd-time-tracker.{out,err}.log
        ~/Library/Logs/mbd-time-tracker.observer.log
NEXT
