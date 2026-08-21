#!/bin/bash
#
# Build a zip one person can be handed to install and try the tracker.
#
#   ./scripts/package-for-tester.sh [output-dir]
#
# Unlike stage-release.sh this does not need the file server, and it adds a
# double-clickable installer plus plain-language instructions, because the
# person opening it is a designer, not the person who wrote it.
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --with-node embeds the Node runtime so the install needs no internet and no
# prerequisites at all. Without it the installer fetches Node itself, which
# keeps the zip about 50 MB smaller.
WITH_NODE=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --with-node) WITH_NODE=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done
OUT="${ARGS[0]:-$HOME/Desktop}"
VERSION="$(date +%Y%m%d)-$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo local)"
NAME="MBD-TimeTracker-$VERSION"
STAGE="$(mktemp -d)/$NAME"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mError:\033[0m %s\n\n' "$*" >&2; exit 1; }

say "Packaging $VERSION"
mkdir -p "$STAGE/app"

# The daemon ships as source; Node runs the TypeScript directly.
mkdir -p "$STAGE/app/daemon/scripts"
cp -R "$REPO/daemon/src" "$STAGE/app/daemon/src"
cp -R "$REPO/daemon/test" "$STAGE/app/daemon/test"
cp "$REPO/daemon/scripts/demo.ts" "$STAGE/app/daemon/scripts/"
cp "$REPO/daemon/scripts/build-preview.ts" "$STAGE/app/daemon/scripts/"
cp "$REPO/daemon/package.json" "$STAGE/app/daemon/"
cp -R "$REPO/observer" "$STAGE/app/observer"
rm -rf "$STAGE/app/observer/.build"
cp -R "$REPO/config" "$STAGE/app/config"
cp -R "$REPO/scripts" "$STAGE/app/scripts"
cp "$REPO/README.md" "$STAGE/app/README.md"
echo "$VERSION" > "$STAGE/app/VERSION"

# A designer should not have to open Terminal to install this. A .command file
# runs on double-click; the shebang keeps it readable if anyone inspects it.
cat > "$STAGE/Install.command" <<'INNER'
#!/bin/bash
cd "$(dirname "$0")/app" || exit 1
clear
cat <<'BANNER'

  ────────────────────────────────────────────────
   MBD Time Tracker — install
  ────────────────────────────────────────────────

  This sets up the tracker on this Mac. It will:

    · check you have the tools it needs
    · build the small helper that watches your work
    · ask for your ClickUp token (once)
    · start it, and keep it running at login

  Nothing is sent to ClickUp until you approve it.

BANNER
read -r -p "  Press return to begin, or close this window to stop. "
echo
exec ./scripts/install.sh
INNER
chmod +x "$STAGE/Install.command"

cat > "$STAGE/READ ME FIRST.txt" <<'INNER'
MBD TIME TRACKER — TEST INSTALL
================================

What this is
------------
It watches which app and file you have open during the day, works out which
ClickUp task that was probably for, and builds you a timesheet to check. You
approve it; only then does anything reach ClickUp.

It never sends anything anywhere on its own.


Before you start
----------------
Nothing. The installer sorts out what it needs.

It downloads a small runtime the first time (about 50 MB) unless that was
included in this package, so be on the internet when you run it.

One exception: if this copy was not staged by Dom, the installer will stop
and say it needs Apple's developer tools. That is expected — it means you
have a plain copy of the source rather than a ready-made one. Tell Dom; he
can send you a staged copy that installs in two minutes without any of it.


Installing
----------
1. Double-click  Install.command

   macOS will probably refuse the first time, because this came from
   outside the App Store. If it does:

       Right-click (or Control-click) Install.command  >  Open  >  Open

2. Follow the prompts. It asks for a ClickUp API token — get yours from
   ClickUp:  your avatar (bottom left) > Settings > Apps > API Token >
   Generate. Copy it and paste it in. It is stored in your Mac's keychain,
   not in a file.

3. The last step is the one nobody can do for you:

       System Settings > Privacy & Security > Accessibility

   Click "+", then press Cmd-Shift-G and paste the path the installer
   printed. Without this the tracker can see which app you are in but not
   which file, and the matching will be poor.


Using it
--------
Open  http://127.0.0.1:7878  in your browser. Same address on every Mac.

Work as normal for a couple of hours, then look. You should see your morning
broken into blocks with a ClickUp task guessed against each one.

  · The tick on the left approves an entry
  · The x deletes one that is wrong
  · Drag a block on the timeline to move it, drag its bottom edge to resize
  · Drag on empty timeline space to add an entry by hand
  · "Push to ClickUp" sends everything you approved


If something looks wrong
------------------------
Run this in Terminal and send the output to Dom:

    cd "$(dirname "$0")/app/daemon" && node src/cli.ts doctor

To see what a particular app is giving up (useful if e.g. Resolve or
Photoshop is not matching well), run this and switch between apps:

    node src/cli.ts probe


Removing it
-----------
    ./app/scripts/install.sh --uninstall

That stops it and removes it from login. Your recorded time stays on disk
until you delete it yourself.
INNER

if (( WITH_NODE )); then
  NODE_VERSION="v22.23.2"
  mkdir -p "$STAGE/app/runtime"
  for arch in darwin-arm64 darwin-x64; do
    tarball="node-$NODE_VERSION-$arch.tar.gz"
    say "Fetching Node for $arch"
    curl -fL --progress-bar -o "$STAGE/app/runtime/$tarball" \
      "https://nodejs.org/dist/$NODE_VERSION/$tarball" || die "Could not download $tarball"
    expected="$(curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" | awk -v f="$tarball" '$2 == f { print $1 }')"
    actual="$(shasum -a 256 "$STAGE/app/runtime/$tarball" | awk '{ print $1 }')"
    [[ "$actual" == "$expected" ]] || die "$tarball did not match its published checksum"
    note "$tarball verified"
  done
  note "Both Apple Silicon and Intel are covered; the installer picks the right one."
fi

say "Zipping"
( cd "$(dirname "$STAGE")" && zip -qr "$OUT/$NAME.zip" "$NAME" )
rm -rf "$(dirname "$STAGE")"

note "Wrote $OUT/$NAME.zip"
note ""
note "Send that to whoever is testing. They double-click Install.command."
if (( WITH_NODE )); then
  note "Node is included, so the install needs nothing else and works offline."
else
  note "Node is not included; the installer downloads it if the Mac lacks it."
  note "Use --with-node for a package that needs no internet at all."
fi
