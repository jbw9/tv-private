#!/usr/bin/env bash
# Point the launcher's (./tv-setup, a copy of jbw9/bonito-tv) personal, gitignored files at this
# repo. Run once per Mac after cloning.
# Signing certificates aren't in git: to deploy from another Mac, copy ~/SamsungCertificate/<profile>
# and ~/tizen-studio-data/profile/profiles.xml over (fix the paths in it if the username differs).
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
TV_DIR="${TV_DIR:-$HERE/tv-setup}"
pairs=("config.local.js:app/config.local.js" "INSTRUCTIONS.md:INSTRUCTIONS.md" "movies/icon.png:app/img/logos/movies.png")
# The APKs' signing key: Android only installs an update signed with the same one.
[ -f release.keystore ] && pairs+=("release.keystore:android/release.keystore")
for pair in "${pairs[@]}"; do
  src="$HERE/${pair%%:*}" dst="$TV_DIR/${pair#*:}"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "$dst is a real file. Merge it into $src, delete it, then rerun." >&2; exit 1
  fi
  ln -sfn "$src" "$dst"
  echo "$dst -> $src"
done
