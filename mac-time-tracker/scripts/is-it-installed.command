#!/bin/bash
#
# Answers one question on whatever Mac it is double-clicked on: is the MBD Time
# Tracker running here, and has it touched the server?
#
# Written to be readable by whoever runs it. It only looks; it changes nothing.
#
DATA_DIR="$HOME/Library/Application Support/MBDTimeTracker"
LABEL="com.motionbydesign.timetracker"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
yes_()  { printf '  \033[31m%s\033[0m\n' "YES  - $*"; }
no_()   { printf '  \033[32m%s\033[0m\n' "no   - $*"; }

clear
bold "Is the MBD Time Tracker on this Mac?"
echo
echo "  $(scutil --get ComputerName 2>/dev/null || hostname)  ·  $(whoami)"
echo

# Only three of these mean it is actually installed. A leftover data folder
# means somebody removed it and the recorded days were kept, which is not the
# same thing and should not be reported as the same thing.
ACTIVE=0

if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  yes_ "it is running (launchctl lists $LABEL)"; ACTIVE=1
else
  no_ "nothing named $LABEL is running"
fi

if ls "$HOME/Library/LaunchAgents" 2>/dev/null | grep -q motionbydesign; then
  yes_ "it is set to start at login"; ACTIVE=1
else
  no_ "it is not set to start at login"
fi

if [[ -d "$DATA_DIR/app/MBD Time Tracker.app" ]]; then
  yes_ "the observer app is installed"; ACTIVE=1
else
  no_ "the observer app is not installed"
fi

LEFTOVER=0
if [[ -d "$DATA_DIR" ]]; then
  (( ACTIVE )) || LEFTOVER=1
  printf '  \033[2m%s\033[0m\n' "     - a data folder exists at $DATA_DIR"
fi

echo
if (( LEFTOVER )); then
  bold "It is NOT running on this Mac."
  echo
  echo "  There is a leftover folder from a previous install, but nothing"
  echo "  is loaded and nothing is being recorded. The tracker is not the"
  echo "  reason this Mac asks for the server."
  echo
elif (( ACTIVE )); then
  bold "It IS installed on this Mac."
  echo
  echo "  What it reaches, and how often -- the only two things off this Mac:"
  CH="$(/usr/bin/python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("update",{}).get("channel","") or "(none set)")' "$DATA_DIR/config.json" 2>/dev/null || echo '(unreadable)')"
  SD="$(/usr/bin/python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("fleet",{}).get("statusDir","") or "(none set)")' "$DATA_DIR/config.json" 2>/dev/null || echo '(unreadable)')"
  echo "    update check, every 6 hours : $CH"
  echo "    health file, every 30 mins : $SD"
  echo
  echo "  Neither is touched at all while that volume is unmounted."
  echo "  Nothing else leaves this Mac except time entries you approve,"
  echo "  which go to api.clickup.com and nowhere else."
  echo
  echo "  To stop it completely:"
  echo "    launchctl bootout gui/\$UID/$LABEL"
  echo "    launchctl bootout gui/\$UID/$LABEL.observer"
else
  bold "It is NOT installed on this Mac."
  echo
  echo "  Nothing here is being tracked, and the tracker is not the reason"
  echo "  this Mac asks for the server."
fi

echo
bold "What IS asking this Mac for the server"
echo
echo "  Anything below is a real reason an Adobe app prompts on launch:"
echo
for f in "$HOME/Library/Fonts" "/Library/Fonts"; do
  n=$(find "$f" -maxdepth 1 -type l 2>/dev/null | wc -l | tr -d ' ')
  [[ "$n" != "0" ]] && echo "    $n font alias(es) in $f -- Adobe reads every font folder at launch"
done
if [[ -d "$HOME/Library/Application Support/Adobe/CoreSync" ]]; then
  echo "    Creative Cloud sync is present (linked assets can live on the server)"
fi
LOGIN="$(osascript -e 'tell application "System Events" to get the name of every login item' 2>/dev/null)"
[[ -n "$LOGIN" ]] && echo "    Login items: $LOGIN"
echo
echo "    Recent files: open Illustrator, File > Open Recent -- any entry on"
echo "    the server makes it reach for the volume at launch."
echo
echo "    Photoshop > Settings > Scratch Disks, and Plug-Ins, if either points"
echo "    at the server."
echo
printf 'Press return to close. '
read -r _
