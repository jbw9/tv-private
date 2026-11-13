# Installing this TV setup on your own Samsung TV

This README is for a friend's Claude (or the friend). It puts the same thing on a Samsung TV
(2020 or newer) that's on Jonathan's: the Bonito launcher as the home screen, and Movies in
it, followed by YouTube and Spotify.

See it running first at https://jbw9.github.io/tv-private: the real launcher, live in the
browser, with the install steps.

`INSTRUCTIONS.md` is the full step-by-step guide, with fixes for every problem we hit. This
file covers what's different when you set it up on **your** Mac and TV. Read both.

## What you need

- A Mac, a Samsung account and a phone with a hotspot.
- This repo. The launcher is in it (`tv-setup/`, a copy of
  https://github.com/jbw9/bonito-tv). Movies is open source at
  https://github.com/jbw9/movies (live at https://jbw9.github.io/movies). The first
  `./deploy.sh` clones it next to this repo as `../movies`, and the TV app is packaged from
  that clone.

## Make it yours before deploying

Some files here are Jonathan's own. Change these first:

1. **`config.local.js`**: replace it with your own settings. Movies first on the home screen,
   Hulu and Disney+ hidden, and the Lakeside design are already the launcher's defaults
   (`tv-setup/app/config.js`), so you only need your name. **Delete the `spotifyClientId` /
   `spotifyRefreshToken` line.** That's Jonathan's Spotify login. To use your own Spotify
   (Premium), log in later from the TV's Settings → PHONE SETUP, or run
   `tv-setup/spotify-login.py`. Supabase (the phone remote, Movies sign-in) is a shared
   project already set in the launcher; there's nothing to set up.
   ```js
   Object.assign(window.CONFIG, {
     name: 'YOUR NAME',
   });
   ```
2. **`certs/`**: ignore it. Those certificates only cover Jonathan's TVs, and a Samsung TV
   refuses apps signed for other devices. Make your own profile instead (below).
3. **The "Known TVs" table in `INSTRUCTIONS.md`** lists Jonathan's TVs. Skip it; your TV
   isn't there.

## Steps

Follow `INSTRUCTIONS.md`, with these changes:

1. **Mac setup (section 1):** install Tizen Studio and Samsung's packages. Then, in
   `tv-private`, run `./link.sh` and `npm install`.
2. **Network and Developer Mode (sections 2–3):** exactly as written.
3. **Connect and get the DUID (section 4):** as written. Note your TV's DUID.
4. **Certificate (section 5):** you have no existing author certificate, so in the
   Certificate Manager choose **Create a new author certificate**. Write its password down:
   every later update must be signed with it. For the distributor certificate, add your
   TV's DUID. Give the profile a name, e.g. `mytv`. Quit the Certificate Manager afterwards.
5. **Install (section 6):**
   ```
   CERT_PROFILE=mytv ./deploy.sh <tv-ip>
   ```
   This installs the launcher and Movies, and prints your TV's phone room.
6. **Sign in to Movies:** the first time Movies opens it shows a QR code. Scan it with a phone
   signed in to Movies at https://jbw9.github.io/movies.
7. **Back to home Wi-Fi:** run `networksetup -setdhcp Wi-Fi` on the Mac, and switch the TV
   back to your Wi-Fi. The apps stay installed.

## Updates

On 2022 and newer TVs, Movies loads the live site, so new Movies features arrive by
themselves, with no reinstall. Launcher changes, and Movies on 2020–21 TVs, need a redeploy:
`git pull` in all three repos, then repeat steps 2, 3 and 5 with the same `CERT_PROFILE`.
