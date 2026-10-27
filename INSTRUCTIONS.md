# Putting the launcher on a Samsung TV

Works on Samsung smart TVs from 2022 on (Tizen 6.5+). Tested on the UN43DU7200DXZA and
UN55DU7200DXZA (2024, Tizen 8). You need a Mac, a Samsung account and a phone hotspot.

The apps stay on the TV once installed. The Mac is only needed to install or update them.

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

The last command prints the TV's DUID, e.g. `P7CIFS3MNP7GA`. Note it down for the certificate.

Known TVs:

| TV                    | DUID            |
| --------------------- | --------------- |
| 43" UN43DU7200DXZA    | `P7CIFS3MNP7GA` |
| 55" UN55DU7200DXZA    | `H3CIFS3MLDSSY` |

## 5. Samsung certificate

The apps must be signed with a certificate that lists every TV's DUID. Deploying signs with
the **active** profile (set `CERT_PROFILE` to use another). On the Mac that set up the two TVs
above it's **`seekertvs`**; this Mac's `tv` profile covers `RLCB2NS2E5SGI`. Skip this step
unless you're adding a TV.

1. Open `~/tizen-studio/tools/certificate-manager/certificate-manager.app`.
2. Click **+** → **Samsung** → **TV** → Next. Give the profile a new name.
3. **Author certificate:** choose **Use an existing author certificate**, browse to
   `~/SamsungCertificate/seekerflap/author.p12`, and enter its password. Always reuse
   this file, so the TVs accept new installs as updates of the apps already on them.
4. **Distributor certificate:** **Create a new distributor certificate**, privilege
   **Public**, and add **every** TV's DUID (old and new).
5. Sign in with your Samsung account when asked, then Finish.

## 6. Install

Run this from `tv-private`, which sits next to `tv-setup` and `movies`. Run `./link.sh` once
per Mac first:

```
./deploy.sh 172.20.10.2
```

Repeat with each TV's IP. The script installs the launcher and Movies, then opens the
launcher. It prints the TV's phone room. The room comes from the TV's DUID, so each TV gets
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

## Back to home Wi-Fi (do this every time you used the hotspot)

The fixed address from step 2 applies to **every** Wi-Fi network, so until you undo it the
Mac won't connect to your home Wi-Fi, even though your other devices do.

1. Open a **separate terminal window**. `sudo` can't ask for your password from inside
   Claude Code. Run:
   ```
   sudo networksetup -setdhcp Wi-Fi
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

### `sdb shell 0 debug <app id>` hangs
Remote debugging doesn't start on these TVs. Don't wait on it. To see what the app is doing,
have it send logs to your computer over HTTP instead.

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
