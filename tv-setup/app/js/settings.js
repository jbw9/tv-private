App.screens.settings = (() => {
  const SPEEDS = ['slow', 'normal', 'fast'];
  const ROW_Y = 270, ROW_H = 68, LEFT = 200, RIGHT = W - 200, VISIBLE = 7;

  const ROWS = [
    { label: 'APPS', value: () => playableApps().length + ' ON', open: true },
    {
      // Classic keeps the home design it was on, to come back to.
      label: 'STYLE',
      value: () => (lakesideStyle() ? 'LAKESIDE' : 'CLASSIC'),
      change: () => {
        if (lakesideStyle()) setDesign(settings.classic || 'bonito');
        else {
          settings.classic = design.key;
          setDesign('lakeside');
        }
        settings.design = design.key;
      },
    },
    {
      label: 'GAME SPEED',
      value: () => settings.speed,
      change: d => { settings.speed = SPEEDS[(SPEEDS.indexOf(settings.speed) + d + SPEEDS.length) % SPEEDS.length]; },
    },
    {
      label: 'LIGHT BAR',
      show: () => !lakesideStyle(),
      value: () => (settings.lightbar ? 'ON' : 'OFF'),
      change: () => { settings.lightbar = !settings.lightbar; },
    },
    {
      label: 'CLOCK',
      value: () => settings.clock,
      change: () => { settings.clock = settings.clock === '12h' ? '24h' : '12h'; },
    },
    {
      label: 'TEMPERATURE',
      value: () => (settings.units === 'fahrenheit' ? '°F' : '°C'),
      change: () => { settings.units = settings.units === 'fahrenheit' ? 'celsius' : 'fahrenheit'; },
    },
    { label: 'RESET BEST', title: 'Reset best scores', value: () => 'ALL GAMES', action: () => Scores.resetLocal() },
    ...(Phones.enabled() ? [{ label: 'PHONE SETUP', value: () => 'NAME, CITY, SPOTIFY', nice: 'Name, city, Spotify', action: () => App.go('setup') }] : []),
    { label: 'DONE', action: () => leave() },
  ];

  const shown = () => ROWS.filter(r => !r.show || r.show());

  let sel = 0, inApps = false, appSel = 0, from = null;

  // `from`: the game whose menu opened settings, to go back to.
  function enter(arg) {
    sel = 0;
    inApps = false;
    from = arg || null;
  }

  function leave() {
    if (from) App.go(from);
    else App.home();
  }

  function update() {}

  function drawRow(g, y, on, label, value, color, arrows) {
    const ink = on ? design.ink : design.dim;
    if (on) drawBullet(g, LEFT - 40, y + 3.5 * 6.5, design.ink);
    drawText(g, label, LEFT, y, 6.5, color || ink, { style: 'thin' });
    if (value != null) {
      const text = arrows && on ? '< ' + value + ' >' : value;
      drawText(g, text, RIGHT, y, 6.5, ink, { style: 'thin', align: 'right' });
    }
  }

  // Lakeside: the words in sentence case, in a frosted panel over the lake, the selected
  // row lit white. The apps list has a switch per app.
  const PANEL_X = 460, PANEL_W = W - 920, LINE = 80, PANEL_Y = 220, APPS_SHOWN = 9;
  const sans = (weight, px) => weight + ' ' + px + 'px ' + SANS_UI;
  // Short values (12h, °C) are kept as they are.
  const nice = t => (t.length <= 3 ? t : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  function drawSwitch(g, x, cy, on, lit) {
    ICONS.rounded(g, x, cy - 18, 64, 36, 18);
    g.fillStyle = on ? '#34c759' : lit ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(on ? x + 46 : x + 18, cy, 14, 0, Math.PI * 2);
    g.fill();
  }

  function drawLakeside(g) {
    drawBackground(g, design.bg[0], design.bg[1]);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.font = sans(300, 64);
    g.fillText(inApps ? 'Apps' : 'Settings', PANEL_X, 140);

    const top = inApps ? Math.max(0, Math.min(appSel - 4, CATALOG.length - APPS_SHOWN)) : 0;
    const items = inApps ? CATALOG.slice(top, top + APPS_SHOWN) : shown();
    const at = inApps ? appSel - top : sel;
    ICONS.rounded(g, PANEL_X - 12, PANEL_Y - 12, PANEL_W + 24, items.length * LINE + 24, 32);
    g.fillStyle = 'rgba(10,14,26,0.5)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.1)';
    g.lineWidth = 1.5;
    g.stroke();

    items.forEach((item, j) => {
      const y = PANEL_Y + j * LINE, cy = y + LINE / 2, on = j === at, right = PANEL_X + PANEL_W - 28;
      if (on) {
        ICONS.rounded(g, PANEL_X, y + 2, PANEL_W, LINE - 4, 22);
        g.fillStyle = 'rgba(255,255,255,0.94)';
        g.fill();
      }
      const ink = on ? '#121725' : '#ffffff', soft = on ? 'rgba(18,23,37,0.6)' : 'rgba(255,255,255,0.6)';
      g.textAlign = 'left';
      g.fillStyle = ink;
      g.font = sans(500, 30);
      if (inApps) {
        const enabled = settings.apps[item.key], available = Platform.isAvailable(item);
        g.globalAlpha = enabled ? 1 : 0.5;
        g.drawImage(ICONS.tile(item, 52), PANEL_X + 22, cy - 26);
        g.globalAlpha = 1;
        g.fillText(title(item.name), PANEL_X + 96, cy);
        if (available) drawSwitch(g, right - 64, cy, enabled, on);
        else {
          g.textAlign = 'right';
          g.fillStyle = soft;
          g.font = sans(400, 26);
          g.fillText(item.hdmi ? 'Nothing plugged in' : 'Not installed', right, cy);
        }
        return;
      }
      g.fillText(item.title || nice(item.label), PANEL_X + 28, cy);
      if (!item.value) return;
      g.textAlign = 'right';
      g.fillStyle = soft;
      g.font = sans(400, 28);
      const value = item.nice || nice(String(item.value()));
      if (item.change && on) g.fillText('‹   ' + value + '   ›', right, cy);
      else if (item.change) g.fillText(value, right, cy);
      else g.fillText(value + '   ›', right, cy);
    });

    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.55;
    g.font = sans(400, 24);
    g.fillText(inApps ? 'OK turns an app on or off   ·   Back returns to settings' : 'Left and right change   ·   OK selects   ·   Back closes', W / 2, H - 56);
    g.globalAlpha = 1;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function draw(g) {
    if (lakesideStyle()) return drawLakeside(g);
    drawBackground(g, design.bg[0], design.bg[1]);
    drawText(g, inApps ? 'APPS' : 'SETTINGS', LEFT - 40, 110, 10, design.ink);

    if (!inApps) {
      shown().forEach((row, i) => {
        drawRow(g, ROW_Y + i * ROW_H, i === sel, row.label, row.value ? row.value() : null, null, !!row.change);
      });
    } else {
      const top = Math.max(0, Math.min(appSel - 3, CATALOG.length - VISIBLE));
      CATALOG.slice(top, top + VISIBLE).forEach((app, j) => {
        const i = top + j;
        const on = settings.apps[app.key];
        const value = Platform.isAvailable(app) ? (on ? 'ON' : 'OFF') : app.hdmi ? 'NOTHING PLUGGED IN' : 'NOT INSTALLED';
        g.globalAlpha = on ? 1 : 0.45;
        g.drawImage(ICONS.tile(app, 56), LEFT - 130, ROW_Y + j * ROW_H - 10);
        g.globalAlpha = 1;
        drawRow(g, ROW_Y + j * ROW_H, i === appSel, app.name, value, on ? app.color : null, true);
      });
    }

    const hint = inApps ? 'OK TOGGLE   BACK DONE' : 'LEFT/RIGHT CHANGE   OK SELECT   BACK DONE';
    drawText(g, hint, W / 2, H - 90, 3.5, design.mute, { style: 'thin', align: 'center' });
    drawLightBar(g);
  }

  function key(k) {
    if (inApps) {
      if (k === 'up') appSel = Math.max(0, appSel - 1);
      else if (k === 'down') appSel = Math.min(CATALOG.length - 1, appSel + 1);
      else if (k === 'ok' || k === 'left' || k === 'right') {
        const app = CATALOG[appSel];
        settings.apps[app.key] = !settings.apps[app.key];
        saveSettings();
      } else if (k === 'back') inApps = false;
      return;
    }
    const rows = shown(), row = rows[sel];
    if (k === 'up') sel = (sel + rows.length - 1) % rows.length;
    else if (k === 'down') sel = (sel + 1) % rows.length;
    else if ((k === 'left' || k === 'right') && row.change) {
      row.change(k === 'left' ? -1 : 1);
      saveSettings();
    } else if (k === 'ok') {
      if (row.open) {
        inApps = true;
        appSel = 0;
      } else if (row.action) row.action();
      else if (row.change) {
        row.change(1);
        saveSettings();
      }
    } else if (k === 'back') leave();
  }

  return { enter, update, draw, key };
})();

// Settings from a phone: a QR code for setup/index.html, which sends the name, city,
// units, design and a Spotify login. They're only taken while this screen is up, so
// only someone in front of the TV can change them.
App.screens.setup = (() => {
  const FIELDS = ['name', 'city', 'units', 'spotifyClientId', 'spotifyRefreshToken', 'spotifyClientSecret', 'spotifyPlaylist'];
  let qr = null, saved = false;

  function enter() {
    saved = false;
    if (!qr) qr = Jam.renderQr(qrMatrix(Phones.url('setup')), null, 520);
  }

  function draw(g) {
    drawBackground(g, design.bg[0], design.bg[1]);
    drawText(g, 'PHONE SETUP', 160, 110, 10, design.ink);
    const lines = saved ? ['SAVED. STARTING AGAIN..'] : ['SCAN THE CODE WITH YOUR', 'PHONE TO SET YOUR NAME,', 'CITY, DESIGN AND SPOTIFY.', '', 'THE TV TAKES THEM WHILE', 'THIS SCREEN IS OPEN.'];
    lines.forEach((line, i) => drawText(g, line, 160, 330 + i * 70, 5, i < 3 ? design.soft : design.dim, { style: 'thin' }));
    g.drawImage(qr, W - 160 - qr.width, 280);
    drawText(g, 'ROOM ' + ROOM, W - 160 - qr.width / 2, 280 + qr.height + 30, 3.5, design.mute, { style: 'thin', align: 'center' });
    drawText(g, 'BACK DONE', W / 2, H - 90, 3.5, design.mute, { style: 'thin', align: 'center' });
    drawLightBar(g);
  }

  function phone(event, p) {
    if (event !== 'setup' || saved) return;
    const profile = Platform.load('profile', {});
    FIELDS.forEach(k => { if (typeof p[k] === 'string') profile[k] = p[k].slice(0, 400); });
    Platform.save('profile', profile);
    if (DESIGNS.some(d => d.key === p.design)) settings.design = p.design;
    if (p.units === 'celsius' || p.units === 'fahrenheit') settings.units = p.units;
    saveSettings();
    saved = true;
    Phones.send('setup-saved', {});
    // A fresh start picks up the new Spotify login and city everywhere.
    setTimeout(() => location.reload(), 1500);
  }

  function key(k) {
    if (k === 'back') App.go('settings');
  }

  return { enter, update() {}, draw, key, phone };
})();
