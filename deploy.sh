#!/usr/bin/env bash
# Install the launcher (../tv) and Heartive (../movies) on a Samsung TV in Developer Mode.
# Usage: ./deploy.sh <tv-ip> [design]
# Env:   CERT_PROFILE  certificate profile from Tizen Certificate Manager (default: seekertvs, covers both TVs)
#        TIZEN_HOME    Tizen Studio install dir (default: ~/tizen-studio)
#        TV_DIR        the public launcher repo (default: ../tv)
#        HEARTIVE_DIR  the movies repo (default: ../movies)
set -euo pipefail

TV_IP="${1:?usage: ./deploy.sh <tv-ip> [design]}"
cd "$(dirname "$0")"
export CERT_PROFILE="${CERT_PROFILE:-seekertvs}"
TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
TIZEN="$TIZEN_HOME/tools/ide/bin/tizen"
SDB="$TIZEN_HOME/tools/sdb"
TV_DIR="${TV_DIR:-$(cd .. && pwd)/tv}"
HEARTIVE_DIR="${HEARTIVE_DIR:-$(cd .. && pwd)/movies}"

# Connects to the TV, then installs and opens the launcher.
"$TV_DIR/deploy.sh" "$@"
SERIAL=$("$SDB" devices | awk -v ip="$TV_IP" 'index($1, ip) == 1 { print $1 }')

rm -rf build dist
mkdir -p build/heartive dist/heartive
cp -R "$HEARTIVE_DIR"/index.html "$HEARTIVE_DIR"/manifest.json "$HEARTIVE_DIR"/assets "$HEARTIVE_DIR"/previews build/heartive/
# cinesrc first, so it's the default player, then vidstuck.
perl -pi -e 's/_priority=\[[^\]]*\]/_priority=["cinesrc","vidstuck","vidy","vidlink","vixsrc","vidfast","vidzee","atlantic","superembed","vidrift","vidnest","primewire"]/' build/heartive/assets/js/embeds.js
grep -q '_priority=\["cinesrc","vidstuck"' build/heartive/assets/js/embeds.js || { echo "Could not set the source order in embeds.js" >&2; exit 1; }
cp heartive/config.xml build/heartive/config.xml
cp "$HEARTIVE_DIR"/previews/favicon-512x512.png build/heartive/icon.png
# -o is resolved against the tizen CLI's own folder unless absolute.
"$TIZEN" package -t wgt -s "$CERT_PROFILE" -o "$PWD/dist/heartive" -- build/heartive
(cd dist/heartive && mv ./*.wgt heartive.wgt && "$TIZEN" install -n heartive.wgt -s "$SERIAL")
