#!/usr/bin/env bash
# Install the launcher (../tv-setup) and Movies (../movies) on a Samsung TV in Developer Mode.
# Usage: ./deploy.sh <tv-ip> [design]
# Env:   CERT_PROFILE  certificate profile from Tizen Certificate Manager (default: the active one)
#        TIZEN_HOME    Tizen Studio install dir (default: ~/tizen-studio)
#        TV_DIR        the public launcher repo, jbw9/bonito-tv (default: ../tv-setup)
#        MOVIES_DIR    the movies repo (default: ../movies)
set -euo pipefail

TV_IP="${1:?usage: ./deploy.sh <tv-ip> [design]}"
cd "$(dirname "$0")"
export CERT_PROFILE="${CERT_PROFILE:-$(sed -n 's/.*<profiles active="\([^"]*\)".*/\1/p' "$HOME/tizen-studio-data/profile/profiles.xml")}"
TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
TIZEN="$TIZEN_HOME/tools/ide/bin/tizen"
SDB="$TIZEN_HOME/tools/sdb"
TV_DIR="${TV_DIR:-$(cd .. && pwd)/tv-setup}"
MOVIES_DIR="${MOVIES_DIR:-$(cd .. && pwd)/movies}"
[ -d node_modules/typescript ] || { echo "Run 'npm install' here first: it builds Movies for older TVs." >&2; exit 1; }

"$SDB" connect "$TV_IP"
SERIAL=$("$SDB" devices | awk -v ip="$TV_IP" 'index($1, ip) == 1 { print $1 }')
if [ -z "$SERIAL" ]; then
  echo "TV not visible to sdb. Check Developer Mode is on and its Host PC IP is this computer." >&2
  exit 1
fi

# Each TV gets its own phone room, the same on every deploy: made from its DUID, in the
# launcher's room alphabet. The launcher and Movies both join it.
DUID=$("$SDB" -s "$SERIAL" shell 0 getduid | tr -dc 'A-Za-z0-9')
[ -n "$DUID" ] || { echo "Couldn't read the TV's DUID." >&2; exit 1; }
ROOM=$(printf '%s' "$DUID" | shasum | cut -c1-16 | perl -ne 'my @abc = split //, "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; print map { $abc[hex($_) % 31] } /(..)/g')
echo "Phone room for this TV: $ROOM"

# Installs and opens the launcher.
ROOM="$ROOM" "$TV_DIR/deploy.sh" "$@"

rm -rf build dist
mkdir -p build/movies dist/movies
cp -R "$MOVIES_DIR"/index.html "$MOVIES_DIR"/manifest.json "$MOVIES_DIR"/assets "$MOVIES_DIR"/previews build/movies/
cp movies/config.xml movies/icon.png build/movies/
sed "s/tv-__ROOM__/tv-$ROOM/" movies/phone.js > build/movies/assets/js/phone.js
# After tv.js, which it needs to have switched on TV mode.
perl -pi -e 's#^(\s*)(<script src="assets/js/tv.js"></script>)#$1$2\n$1<script src="assets/js/phone.js"></script>#' build/movies/index.html
grep -q 'assets/js/phone.js' build/movies/index.html || { echo "Couldn't add phone.js to Movies' index.html" >&2; exit 1; }
# A second copy for 2020-21 TVs, whose browsers are too old for Movies as it is (movies/legacy.js).
node movies/legacy.js build/movies
# The app opens the website's newest Movies (movies/boot.html), and falls back to this packaged
# copy offline and on 2020-21 TVs.
mv build/movies/index.html build/movies/app.html
cp movies/boot.html build/movies/index.html
# -o is resolved against the tizen CLI's own folder unless absolute.
"$TIZEN" package -t wgt -s "$CERT_PROFILE" -o "$PWD/dist/movies" -- build/movies
(cd dist/movies && mv ./*.wgt movies.wgt && "$TIZEN" install -n movies.wgt -s "$SERIAL")

# The launcher, opened above, only finds installed apps when it starts, so it's restarted to
# pick up Movies.
"$SDB" -s "$SERIAL" shell 0 was_kill SkrFlap001.SeekerFlap || true
"$TIZEN" run -p SkrFlap001.SeekerFlap -s "$SERIAL"
