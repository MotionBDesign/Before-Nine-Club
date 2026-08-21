#!/bin/bash
#
# Compile the observer with swiftc directly — no Swift Package Manager.
#
#   ./observer/build.sh [output-path]
#
# SwiftPM has to compile Package.swift against the toolchain's
# PackageDescription library before it can build anything, and that step is
# where installs kept failing ("Invalid manifest", undefined PackageDescription
# symbols) on Macs with only the Command Line Tools. None of it is needed for a
# handful of source files in one executable, so this skips the whole subsystem
# and calls the compiler.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/.build/release/BNObserver}"
SOURCES=("$HERE"/Sources/BNObserver/*.swift)

[[ -e "${SOURCES[0]}" ]] || { echo "No Swift sources found under $HERE/Sources/BNObserver" >&2; exit 1; }

case "$(uname -m)" in
  arm64) TARGET="arm64-apple-macos13.0" ;;
  x86_64) TARGET="x86_64-apple-macos13.0" ;;
  *) echo "Unsupported processor: $(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$(dirname "$OUT")"

swiftc \
  -O -whole-module-optimization \
  -target "$TARGET" \
  -o "$OUT" \
  "${SOURCES[@]}" \
  -framework AppKit \
  -framework ApplicationServices \
  -framework IOKit

chmod +x "$OUT"
echo "$OUT"
