#!/usr/bin/env bash
# Point ../tv-setup's personal, gitignored files at this repo. Run once per Mac after cloning
# next to ../tv-setup (jbw9/bonito-tv) and ../movies.
# Signing certificates aren't in git: to deploy from another Mac, copy ~/SamsungCertificate/<profile>
# and ~/tizen-studio-data/profile/profiles.xml over (fix the paths in it if the username differs).
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
TV_DIR="${TV_DIR:-$(cd .. && pwd)/tv-setup}"
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
# The logo isn't in the public repo's .gitignore; keep it out of its git status locally.
grep -qx 'app/img/logos/movies.png' "$TV_DIR/.git/info/exclude" || echo 'app/img/logos/movies.png' >> "$TV_DIR/.git/info/exclude"
