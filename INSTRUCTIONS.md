# Putting the launcher on a Samsung TV

Works on Samsung smart TVs from 2020 on (Tizen 6.0+). Tested on the UN43DU7200DXZA and
UN55DU7200DXZA (2024, Tizen 8) and the UN65TU700DFXZA (2020, Tizen 6.0). You need a Mac, a
Samsung account and a phone hotspot.

The apps stay on the TV once installed. The Mac is only needed to install or update them.

## Quick deploy (a TV that's been set up before)

Everything below, in order, for a TV in the [known TVs](#known-tvs) table:

1. **Phone:** Personal Hotspot on, with **Maximize Compatibility** on.
2. **TV:** on the hotspot (Settings → General & Privacy → Network). Note its IP from Network
   Status → IP Settings.
3. **Mac:** join the hotspot, then give it the address the TV's Developer Mode expects
   (the table's "Host PC IP"). This works without `sudo` for an admin account:
   ```
   networksetup -setmanual Wi-Fi 172.20.10.12 255.255.255.240 172.20.10.1
   ifconfig en0 | grep 'inet '        # wait until it shows 172.20.10.12
   ```
4. **Connect** (retry a few times; see [sdb problems](#sdb-connect-says-failed-to-connect-but-port-26101-is-open)):
   ```
   ~/tizen-studio/tools/sdb connect <tv-ip>
   ~/tizen-studio/tools/sdb devices    # the TV's model, marked "device"
   ```
5. **Deploy** from `tv-private`, with the TV's certificate profile from the table:
   ```
   CERT_PROFILE=<profile> ./deploy.sh <tv-ip>
   ```
6. **Mac back to normal Wi-Fi:** `networksetup -setdhcp Wi-Fi`. The TV can go back to home
   Wi-Fi too; the apps keep working.

If the TV's IP or the Mac's address changed, Developer Mode needs the new Host PC IP and a
full restart (step 3 below).

## Known TVs

| TV                          | Year, Tizen | DUID            | Cert profile | Host PC IP     | Movies          |
| --------------------------- | ----------- | --------------- | ------------ | -------------- | --------------- |
| 43" UN43DU7200DXZA          | 2024, 8     | `P7CIFS3MNP7GA` | `seekertvs`* | `172.20.10.5`  | as is           |
| 55" UN55DU7200DXZA          | 2024, 8     | `H3CIFS3MLDSSY` | `seekertvs`* | `172.20.10.5`  | as is           |
| The `tv` profile's TV       | ?           | `RLCB2NS2E5SGI` | `tv`         | `172.20.10.5`  | picked at start |
| 65" UN65TU700DFXZA          | 2020, 6.0   | `JHCB2NS2E5T6G` | `new`        | `172.20.10.12` | older-browser copy |

The 65" TV's phone room is `QXFXQKCW`. On its hotspot setup the TV took `172.20.10.5`, so the
Mac uses `.12`. "Movies" is which copy the TV loads (see
[Movies on older TVs](#movies-on-older-tvs)); it picks by itself, nothing to set.

\* On the Mac that set those two up, not this one. This Mac has `tv` (the active profile) and
`new`. A TV must always be deployed with the same profile, because its author certificate has
to match the apps already installed (see step 5).

## 1. One-time Mac setup

1. Install the Tizen Studio command-line tools to `~/tizen-studio`:
   - Download `web-cli_Tizen_Studio_6.1_macos-64.bin` from
     https://download.tizen.org/sdk/Installer/tizen-studio_6.1/
   - Run `chmod +x web-cli_*.bin && ./web-cli_*.bin --accept-license ~/tizen-studio`
2. Install Samsung's TV and certificate packages. The package manager needs the Java that
   ships with Tizen Studio:
   ```
   cd ~/tizen-studio/package-manager
   ~/tizen-studio/jdk/Contents/Home/bin/java -jar PackageManagerV2-cli.jar install --accept-license \
     Certificate-Manager cert-add-on TV-SAMSUNG-Extension-Tools TV-SAMSUNG-Extension-Resources
   ```
   Skip the emulator package. It's large and not needed.
3. In `tv-private` (next to `tv-setup` and `movies`), run `./link.sh`, then `npm install`
   (or `bun install`). That installs TypeScript, which builds Movies' copy for older TVs.
   `deploy.sh` stops and says so if it's missing.

## 2. Put the Mac and TV on the same network

Home routers often stop devices from talking to each other, so use your phone's hotspot.

1. **Phone:** turn on Personal Hotspot. On iPhone, also turn on **Maximize Compatibility**.
2. **TV:** Settings → General & Privacy → Network → Open Network Settings → Wireless → pick
   the hotspot.
3. **TV's IP address:** Settings → General & Privacy → Network → Network Status → IP
   Settings. It's usually `172.20.10.2` or `172.20.10.3`.
4. **Mac:** join the hotspot. iPhone hotspots can give the Mac only an IPv6 address, which
   the TV can't reach, so give it a fixed IPv4 address in a terminal:
   ```
   sudo networksetup -setmanual Wi-Fi 172.20.10.5 255.255.255.240 172.20.10.1
   ```
   **Undo this when you're done (see "Back to home Wi-Fi" below), or the Mac won't connect
   to any other Wi-Fi.**

   If macOS says **"Another device on the network is using your computer's IP address"**,
   something else (often the TV) already has `.5`. Pick another address from `.2` to `.14`,
   such as `172.20.10.12`, and use that as the Host PC IP in step 3. `networksetup` (without
   `sudo`) works from Claude Code for an admin account.

## 3. Turn on Developer Mode on the TV

1. Press **Home** on the remote and open the **Apps** tab from the home bar.
2. Scroll **all the way down** to the bottom of the Apps screen and open **App Settings**.
   On some versions it's a gear icon in the top-right corner instead.
3. Once the App Settings screen is open, press the **123** button on the remote (four colored
   dots, near the volume rocker). An on-screen number pad appears.
4. Enter **1 2 3 4 5**. If nothing happens, try **0 0 0 0 0**, or plug in a USB keyboard and
   type the digits.
5. In the **Developer Mode** box, switch it **On**, set **Host PC IP** to `172.20.10.5` (the
   Mac's address from step 2), and select **OK**.
6. **Restart the TV:** hold the power button until it turns off and on again. Developer Mode
   only takes effect after a full restart.
7. Back on the Apps screen, **Develop Mode** now shows at the top.

If the Mac's IP ever changes, repeat these steps with the new address and restart again.

## 4. Connect and get the TV's device ID

```
~/tizen-studio/tools/sdb connect 172.20.10.2      # the TV's IP
~/tizen-studio/tools/sdb devices                  # should list the TV's model
~/tizen-studio/tools/sdb -s 172.20.10.2:26101 shell 0 getduid
```

If `connect` fails, run `~/tizen-studio/tools/sdb kill-server` and try again a few times.

The last command prints the TV's DUID, e.g. `P7CIFS3MNP7GA`. Note it down for the certificate,
and add the TV to the [known TVs](#known-tvs) table.

## 5. Samsung certificate

The apps must be signed with a certificate that lists every TV's DUID. Deploying signs with
the **active** profile (set `CERT_PROFILE` to use another). The [known TVs](#known-tvs) table
says which profile covers which TV. Skip this step unless you're adding a TV.

Check whether a profile covers a TV:
```
grep -o '<TestDevice>[^<]*' ~/SamsungCertificate/<profile>/device-profile.xml
```

**Lost the author certificate's password?** Then make the new profile with **Create a new
author certificate** (write the password down) and list only the new TV. That TV must then
always be deployed with this profile, and the other TVs with theirs. A TV's installed apps
only accept updates signed by the same author certificate; switching means uninstalling
them first. This is how `new` was made for the 65" TV.

1. Open `~/tizen-studio/tools/certificate-manager/certificate-manager.app`.
2. Click **+** → **Samsung** → **TV** → Next. Give the profile a new name.
3. **Author certificate:** choose **Use an existing author certificate**, browse to the
   author certificate the TVs already use (`~/SamsungCertificate/<profile>/author.p12`, e.g.
   `tv` on this Mac, `seekerflap` on the other), and enter its password. Always reuse this
   file, so the TVs accept new installs as updates of the apps already on them. The file
   picker doesn't understand `~`: press **Cmd+Shift+G** and paste the full path, e.g.
   `/Users/jonathanbernard/SamsungCertificate/tv/author.p12`.
4. **Distributor certificate:** **Create a new distributor certificate**, privilege
   **Public**, and add **every** TV's DUID (old and new).
5. Sign in with your Samsung account when asked, then Finish.
6. **Quit the Certificate Manager.** While it's open it runs its own sdb server, and
   `sdb connect` fails until it's closed.

## 6. Install

Run this from `tv-private`, which sits next to `tv-setup` and `movies`. Run `./link.sh` and
`npm install` once per Mac first (step 1):

```
CERT_PROFILE=<profile> ./deploy.sh 172.20.10.2
```

Repeat with each TV's IP and profile. The script installs the launcher and Movies, then
restarts the launcher so it finds Movies (it only looks for installed apps when it starts).
Movies is built from the `movies` folder as it is on disk, so pull or commit there first:
whatever's in it, like Rotten Tomatoes, is what the TV gets. It prints the TV's phone room. The room comes from the TV's DUID, so each TV gets
its own and keeps it on every deploy. Phones paired before the room changed need to scan the
TV's QR code again. Don't use `tv-setup/deploy.sh` here: it installs only the launcher, without
Movies or a fixed room.

The first time Movies opens, it shows a code and a QR code. Scan it with a phone that's
signed in to Movies (or sign in on the phone after scanning) to sign in the TV. You don't have
to type a password on the TV.

When you're done:

1. **TV:** switch Wi-Fi back to your home network. Developer Mode can stay on.
2. **Mac:** put Wi-Fi back to automatic:
   ```
   sudo networksetup -setdhcp Wi-Fi
   ```

To update later, repeat steps 2, 4 and 6. Developer Mode and the certificate are already set.

## Movies on older TVs

2020-21 Samsungs (Tizen 6.0, Chromium 76 or older) can't run Movies as it's written. Their
browser can't read `?.`, `??` or `||=`, and its CSS has no `aspect-ratio`, `inset`,
`clamp()`/`min()`/`max()`, `:is()`/`:has()` or flex `gap`. On those TVs, Movies used to show
just the website's top bar on an empty page.

So `deploy.sh` ships two copies in one app (`movies/legacy.js` builds the second):

- `assets/js` and `assets/css`: Movies exactly as in the `movies` repo. Newer TVs load these.
- `assets/js-legacy` and `assets/css-legacy`: the same code made safe for old browsers:
  - **Scripts:** compiled to ES2018 by TypeScript, with `:is()` in selector strings spelled
    out. `polyfills.js` adds `matchAll` and `Promise.allSettled`.
  - **Stylesheets:** `inset` written as top/right/bottom/left, and
    `clamp()`/`min()`/`max()` worked out for 1920x1080. Selectors are split apart, so one
    `:has()` doesn't drop a whole rule.
  - **`layout.js`:** turns flex `gap` into margins and sets heights for `aspect-ratio` boxes
    as pages draw.

`index.html` picks between them when it starts: no `CSS.supports('aspect-ratio: 1')` (added in
Chromium 88) means the legacy copy. Both copies come from the same source on every deploy, so
new Movies features (like Rotten Tomatoes) reach old TVs without extra work. Check a feature
on an old TV after adding it, though: a new CSS or JavaScript feature might need adding to
`legacy.js` or `polyfills.js`. To try the legacy copy in a desktop browser, open Movies with
`?legacy=1` (spacing looks doubled there, since that browser does flex gap too).

## Debugging an app on the TV

On Tizen 6.0 this works (on newer TVs `debug` may hang):
```
~/tizen-studio/tools/sdb -s <tv-ip>:26101 shell 0 was_kill HrtvTV0001.Heartive
~/tizen-studio/tools/sdb -s <tv-ip>:26101 shell 0 debug HrtvTV0001.Heartive   # prints "port: N"
curl http://<tv-ip>:N/json      # Chrome DevTools Protocol: Runtime.evaluate works,
                                # Page.captureScreenshot hangs
```
The launcher's app ID is `SkrFlap001.SeekerFlap`. `debug` prints nothing if the app is
already running; that's what the `was_kill` is for.

## Back to home Wi-Fi (do this every time you used the hotspot)

The fixed address from step 2 applies to **every** Wi-Fi network, so until you undo it the
Mac won't connect to your home Wi-Fi, even though your other devices do.

1. Run this (an admin account doesn't need `sudo`; if it's refused, use `sudo` in a
   **separate terminal window**, since `sudo` can't ask for a password inside Claude Code):
   ```
   networksetup -setdhcp Wi-Fi
   ```
   Or use System Settings: **Wi-Fi** → **Details…** next to the network → **TCP/IP** →
   **Configure IPv4: Using DHCP** → **OK**.
2. Reconnect: click the Wi-Fi icon in the menu bar and pick your home network. If it's
   already selected, turn Wi-Fi off and on.
3. Check it worked: `networksetup -getinfo Wi-Fi` should say **DHCP Configuration** and show
   your home address, not `172.20.10.5`.
4. **TV:** Settings → General & Privacy → Network → Open Network Settings → Wireless → pick
   your home network. The apps keep working. Developer Mode can stay on.

## Common problems

Every problem below came up during a real setup. Each one lists what you see, then the fix.

### Package manager says "Java Development Kit (JDK) was not found"
`package-manager-cli.bin` can't find Java, even if you have one installed. Run the jar with
the Java that ships with Tizen Studio:
```
cd ~/tizen-studio/package-manager
~/tizen-studio/jdk/Contents/Home/bin/java -jar PackageManagerV2-cli.jar show-pkgs
```

### Typing 1 2 3 4 5 does nothing (no Developer Mode box)
- The code only works on the **App Settings** screen: Apps tab → scroll **all the way
  down** → **App Settings**. It doesn't work on the main Apps screen.
- Enter the digits with the remote's **123** button (four colored dots), which opens the
  on-screen number pad.
- Still nothing? Try **0 0 0 0 0**, or plug a USB keyboard into the TV.

### The computer can't reach the TV on home Wi-Fi
`ping <tv-ip>` times out, even though both devices are on the same Wi-Fi. The router blocks
devices from talking to each other (client isolation). Your settings aren't the cause, and
the macOS "Local Network" permission isn't either.

Check:
```
nc -z -G 3 <tv-ip> 8001 && echo reachable
```
Fix: use a phone hotspot for setup (step 2).

### On the iPhone hotspot, the Mac's IP is 192.0.0.2 and the TV is unreachable
The hotspot gave the Mac only IPv6. `192.0.0.2` is a stand-in address, not a real IPv4
address on the hotspot's network.

Check:
```
ifconfig en1 | grep 'inet '     # 192.0.0.2 = the problem
networksetup -getinfo Wi-Fi
```
Fix: give the Mac a fixed address in a separate terminal:
```
sudo networksetup -setmanual Wi-Fi 172.20.10.5 255.255.255.240 172.20.10.1
```
Developer Mode's Host PC IP must then be `172.20.10.5`, and the TV must be restarted after
you change it.

### `sudo: a terminal is required to read the password`
`sudo` was run from Claude Code's `!` prompt, which can't ask for a password. Run the same
command in a separate Terminal or Ghostty window.

### `sdb connect` says "failed to connect", but port 26101 is open
First check what the TV thinks. `developerMode` should be `"1"` and `developerIP` should be
your computer's IP:
```
curl -s http://<tv-ip>:8001/api/v2/ | grep -oE '"developer(Mode|IP)": "[^"]*"'
```
If both look right, restart sdb and retry. It often works on the second or third try:
```
~/tizen-studio/tools/sdb kill-server
~/tizen-studio/tools/sdb connect <tv-ip>:26101
~/tizen-studio/tools/sdb devices
```
If `developerIP` is wrong, fix it in Developer Mode (step 3) and fully restart the TV.

### `tizen package` writes the .wgt somewhere else (`cd: dist/launcher: No such file`)
The tizen CLI resolves a relative `-o` against its own folder, so the file ends up in
`~/tizen-studio/tools/ide/bin/dist/`. Always pass an absolute path, e.g.
`-o "$PWD/dist/launcher"`. `deploy.sh` already does this.

### "Failed to install Tizen application" with no other detail
There are two causes:
1. **A space in the .wgt filename.** The package is named after the app (`Seeker Flap.wgt`),
   and the TV's installer silently fails on spaces. Rename it before installing:
   ```
   mv "Seeker Flap.wgt" launcher.wgt
   ~/tizen-studio/tools/ide/bin/tizen install -n launcher.wgt -s <tv-ip>:26101
   ```
   `deploy.sh` already does this.
2. **The TV isn't in the certificate.** See the next problem.

### A second TV won't install (the certificate only covers the first)
Distributor certificates list specific TVs by DUID. Get the new TV's DUID:
```
~/tizen-studio/tools/sdb -s <tv-ip>:26101 shell 0 getduid
```
In the Certificate Manager, **Edit** on the distributor certificate only lets you pick a
different file. **Cancel** it and make a new profile instead:
1. Click **+** → **Samsung** → **TV**, and give the profile a new name.
2. Choose **Use an existing author certificate** and pick your old `author.p12` with its
   password. Reusing it keeps installed apps updatable.
3. Create a new distributor certificate that lists **every** TV's DUID.
4. Deploy with `CERT_PROFILE=<new name>`.

Check which profiles exist, and which is active:
```
grep -o 'profile name="[^"]*"\|active="[^"]*"' ~/tizen-studio-data/profile/profiles.xml
```

### `tizen install` / `tizen run` says "Can not get the target option"
The TV isn't connected to sdb. It may have left the hotspot, turned off, or changed IP.
Check `~/tizen-studio/tools/sdb devices`, then reconnect.

### `sdb connect` keeps failing while the Certificate Manager is open
The Certificate Manager starts its own sdb server (`sdb fork-server server
--only-detect-tizen`), which doesn't connect to TVs over the network. Quit the Certificate
Manager, then:
```
~/tizen-studio/tools/sdb kill-server
~/tizen-studio/tools/sdb start-server
~/tizen-studio/tools/sdb connect <tv-ip>
```

### Movies shows only the top bar on an empty page
The TV's browser is too old for Movies as written, and it didn't get the legacy copy. Check
that `deploy.sh` printed `Movies: N scripts and 3 stylesheets, with an older-browser copy`.
If it did, debug the app (see [Debugging](#debugging-an-app-on-the-tv)) and look for errors
from `assets/js-legacy`: a new JavaScript or CSS feature in Movies may need adding to
`movies/legacy.js` or `movies/polyfills.js`.

### The Movies tile is missing from the launcher
The launcher was already running when Movies was installed: it only looks for apps when it
starts. `deploy.sh` restarts it at the end. Otherwise restart the TV (hold power).

### `sdb shell 0 debug <app id>` hangs
On the 2024 TVs remote debugging doesn't start, so don't wait on it. To see what the app is
doing there, have it send logs to your computer over HTTP instead. On Tizen 6.0 it works:
see [Debugging](#debugging-an-app-on-the-tv).

### An HDMI input doesn't show in the launcher
The launcher lists only ports the TV reports as **connected**. Most TVs report a port as
disconnected while the device on it is off or asleep, even with the cable in.
- Turn the device on.
- Reseat the cable.
- Check you're looking at the TV it's plugged into.

The list updates live; you don't need to restart the launcher.

### After setup, the Mac won't join home Wi-Fi (other devices are fine)
The fixed hotspot address is still set, and macOS applies it to every Wi-Fi network.
Check:
```
networksetup -getinfo Wi-Fi     # "Manual Configuration" + 172.20.10.5 = the problem
```
Fix: see
[Back to home Wi-Fi](#back-to-home-wi-fi-do-this-every-time-you-used-the-hotspot). In short,
run this in a separate terminal, then reconnect:
```
sudo networksetup -setdhcp Wi-Fi
```
