// The home screen. What's on it (apps, the GAMES folder, CONNECT PHONE, SETTINGS), the
// clock and weather are shared; each design (js/designs.js) lays them out its own way
// below and may move around them its own way too.
App.screens.home = (() => {
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SKY = {
    sun: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'],
    moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
    cloud: ['.........', '...##....', '..####.#.', '.########', '#########', '#########', '.#######.'],
    rain: ['...##....', '..#####..', '.#######.', '#########', '.........', '.#..#..#.', '#..#..#..'],
    snow: ['...##....', '..#####..', '.#######.', '#########', '.........', '#.#.#.#.#', '.#.#.#.#.'],
    storm: ['...##....', '..#####..', '.#######.', '#########', '....#....', '...##....', '....#....'],
  };
  const SANS = '"Helvetica Neue", SamsungOne, Roboto, "Segoe UI", Arial, sans-serif';

  // Brand logos shown beside the selected entry, keyed by catalog key, as they load.
  const LOGOS = {};
  ['youtube', 'netflix', 'hulu', 'disney', 'prime', 'max', 'peacock', 'appletv', 'paramount', 'spotify', 'popeyes'].concat((CONFIG.apps || []).map(a => a.key)).forEach(k => {
    const img = new Image();
    img.onload = () => { LOGOS[k] = prepLogo(img); };
    img.src = 'img/logos/' + k + '.png';
  });

  const FOLDER = { key: 'games', name: 'GAMES', short: 'GAMES', color: '#F4F6F8' };
  const SETTINGS = { key: 'settings', name: 'SETTINGS', short: 'SETTINGS', color: '#F4F6F8' };
  const CONNECT = { key: 'connect', name: 'CONNECT PHONE', short: 'PHONE', color: '#1DB954' };
  const LOGO_W = 280, LOGO_H = 140;

  // focus: 'list' (the design's main row or column), 'music' (the controls row) or a
  // design's own extra row. changed: when the selection last moved, for animations.
  let sel = 0, focus = 'list', scrollPos = 0, weather = null, nextFetch = 0, open = false, changed = 0;
  const qrs = {}; // the phone page's QR code per size, made the first time it shows

  // Home rows: the enabled apps, with the games collapsed into one GAMES folder
  // that lists them underneath while open, then CONNECT PHONE (when set up) and SETTINGS.
  function rows() {
    const out = [];
    playableApps().forEach(app => {
      if (app.group !== 'games') return out.push({ app });
      if (!out.some(r => r.folder)) out.push({ app: FOLDER, folder: true });
      if (open) out.push({ app, child: true });
    });
    if (Phones.enabled()) out.push({ app: CONNECT, connect: true });
    out.push({ app: SETTINGS, settings: true });
    return out;
  }

  function closeFolder() {
    open = false;
    sel = rows().findIndex(r => r.folder);
  }

  function activate(row) {
    if (row.folder) open = !open;
    else if (row.settings) App.go('settings');
    else if (row.connect) return;
    else {
      remember(row.app);
      if (row.app.game) App.go(row.app.key);
      else App.go('splash', { app: row.app });
    }
  }

  // Recently opened apps and games, newest first, for designs that show them.
  function remember(app) {
    settings.recent = [app.key].concat((settings.recent || []).filter(k => k !== app.key)).slice(0, 8);
    saveSettings();
  }

  function recentApps() {
    const playable = playableApps();
    return (settings.recent || []).map(k => playable.find(a => a.key === k)).filter(Boolean);
  }

  function skyIcon(w) {
    const c = w.code;
    if (c >= 95) return SKY.storm;
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return SKY.snow;
    if (c >= 51) return SKY.rain;
    if (c >= 2) return SKY.cloud;
    return w.day ? SKY.sun : SKY.moon;
  }

  // Open-Meteo's weather codes in words.
  function skyWords(w) {
    const c = w.code;
    if (c >= 95) return 'Thunderstorms';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'Snow';
    if (c >= 61) return 'Rain';
    if (c >= 51) return 'Drizzle';
    if (c >= 45) return 'Fog';
    if (c === 3) return 'Cloudy';
    if (c === 2) return 'Partly cloudy';
    return c === 1 ? 'Mostly clear' : 'Clear';
  }

  let askedUnit = null;
  function refreshWeather() {
    const now = Date.now();
    // Switching °C/°F in Settings fetches again straight away.
    if (now < nextFetch && askedUnit === settings.units) return;
    askedUnit = settings.units;
    nextFetch = now + 15 * 60e3;
    Platform.weather(settings.units).then(w => { weather = w; }).catch(() => { nextFetch = Date.now() + 2 * 60e3; });
  }

  function two(n) {
    return ('0' + n).slice(-2);
  }

  function timeText(d, bare) {
    let h = d.getHours();
    if (settings.clock === '24h') return two(h) + ':' + two(d.getMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + two(d.getMinutes()) + (bare ? '' : ' ' + ampm);
  }

  function kind(app) {
    if (app.hdmi) return 'Input';
    if (app.multi) return 'Party game';
    if (app.group === 'games') return 'Game';
    return 'App';
  }

  function phoneQr(size) {
    if (!qrs[size]) qrs[size] = Jam.renderQr(qrMatrix(Phones.url()), null, size);
    return qrs[size];
  }

  // Each logo is shrunk once, in halving steps, to its on-screen size so the TV
  // draws it pixel for pixel.
  function prepLogo(img) {
    const s = Math.min(LOGO_W / img.naturalWidth, LOGO_H / img.naturalHeight);
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
    while (sw / 2 > w) {
      const half = makeCanvas(Math.round(sw / 2), Math.round(sh / 2), b => {
        b.imageSmoothingQuality = 'high';
        b.drawImage(src, 0, 0, Math.round(sw / 2), Math.round(sh / 2));
      });
      src = half;
      sw = half.width;
      sh = half.height;
    }
    return makeCanvas(w, h, b => {
      b.imageSmoothingQuality = 'high';
      b.drawImage(src, 0, 0, w, h);
    });
  }

  function font(weight, px) {
    return weight + ' ' + px + 'px ' + SANS;
  }

  // Frosted glass: the scene behind, shrunk and blown back up, under a pale wash.
  function glass(g, blur, x, y, w, h, r, wash) {
    g.save();
    ICONS.rounded(g, x, y, w, h, r);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(blur, 0, 0, W, H);
    g.fillStyle = wash || 'rgba(255,255,255,0.16)';
    g.fillRect(x, y, w, h);
    g.restore();
    ICONS.rounded(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  // Sections across, items down, for Panorama and Media bar; rebuilt each frame, as
  // inputs come and go.
  function menu() {
    const all = playableApps();
    const out = [
      { key: 'tv', name: 'TV & Video', items: all.filter(a => a.group !== 'games').map(app => ({ app })) },
      { key: 'games', name: 'Games', items: all.filter(a => a.group === 'games').map(app => ({ app })) },
    ];
    if (Phones.enabled()) out.push({ key: 'connect', name: 'Phone', items: [{ app: CONNECT, connect: true }] });
    out.push({ key: 'settings', name: 'Settings', items: [{ app: SETTINGS, settings: true }] });
    return out.filter(c => c.items.length);
  }

  // ---- Bonito: the dot-matrix list ------------------------------------------
  // After a TV home screen by @tyler_ (instagram.com/tyler_).

  const bonito = (() => {
    const ROW_H = 96, LIST_Y = 560, LIST_X = 130;

    // Small triangle after the GAMES label: right when closed, down when open.
    function drawCaret(g, x, y, color) {
      g.fillStyle = color;
      g.beginPath();
      if (open) {
        g.moveTo(x, y - 8);
        g.lineTo(x + 22, y - 8);
        g.lineTo(x + 11, y + 6);
      } else {
        g.moveTo(x + 4, y - 12);
        g.lineTo(x + 18, y - 1);
        g.lineTo(x + 4, y + 10);
      }
      g.fill();
    }

    function draw(g) {
      drawBackground(g, design.bg[0], design.bg[1]);

      const list = rows();
      list.forEach((row, i) => {
        const d = i - scrollPos;
        if (Math.abs(d) > 3.6) return;
        const y = LIST_Y + d * ROW_H;
        const app = row.app, x = row.child ? LIST_X + 70 : LIST_X;
        let w;
        if (i === sel && focus === 'list') {
          const cell = row.child ? 7.5 : 8.5;
          drawBullet(g, x - 34, y, app.color);
          w = drawText(g, app.name, x, y - 3.5 * cell, cell, app.color);
        } else {
          const cell = row.child ? 5.5 : 6;
          const color = i === sel ? app.color : design.dim;
          w = drawText(g, app.name, x, y - 3.5 * cell, cell, color, { style: 'thin', alpha: Math.max(0.12, 1 - Math.abs(d) * 0.26) });
        }
        if (row.folder) drawCaret(g, x + w + 28, y, i === sel ? app.color : design.dim);
      });

      const right = W - 120;
      const name = 'HELLO ' + CONFIG.name;
      drawText(g, name, right, 120, Math.min(10, 1000 / (name.length * 6)), design.ink, { align: 'right' });
      const now = new Date();
      drawText(g, timeText(now), right, 230, 12, design.ink, { align: 'right' });
      drawText(g, DAYS[now.getDay()] + ' ' + MONTHS[now.getMonth()] + ' ' + now.getDate(), right, 354, 5, design.soft, { style: 'thin', align: 'right' });
      if (weather) {
        const w = drawText(g, weather.temp + '°', right, 410, 6, design.ink, { align: 'right' });
        const ic = skyIcon(weather);
        drawIcon(g, ic, right - w - 30 - ic[0].length * 5, 410 + 3.5 * 6 - 3.5 * 5, 5, design.ink);
      }

      // CONNECT PHONE shows the phone page's QR code where the app logo goes.
      const row = list[sel];
      if (row.connect) {
        const qr = phoneQr(460);
        g.drawImage(qr, right - qr.width, 470);
        drawText(g, 'REMOTE, SPOTIFY AND GAMES', right - qr.width / 2, 470 + qr.height + 26, 3.5, design.soft, { style: 'thin', align: 'center' });
        drawText(g, 'ROOM ' + ROOM, right - qr.width / 2, 470 + qr.height + 66, 3.5, design.mute, { style: 'thin', align: 'center' });
      } else if (LOGOS[row.app.key]) {
        const logo = LOGOS[row.app.key];
        g.drawImage(logo, Math.round(right - logo.width), Math.round(590 - logo.height / 2));
      }

      Music.draw(g, focus === 'music');
      drawLightBar(g);
    }

    return { axis: 'v', draw };
  })();

  // ---- Horizon: a mountain photo, a big clock behind the peak, and a dock ----
  // After a smart TV home by @joshuaseage (instagram.com/joshuaseage). The photo is
  // images.unsplash.com/photo-1483728642387-6c3bdd6c93e5 (Unsplash License); its mask
  // is the mountains alone, cut along the ridge so they can stand in front of the clock.

  const horizon = (() => {
    // Light over the photo by time of day (a blend mode and colour), and the clock's ink.
    const SCENES = {
      night: { tint: ['multiply', 'rgb(88,98,160)'], clock: ['rgba(240,243,255,0.9)', 'rgba(160,170,235,0.5)'] },
      dawn: { tint: ['soft-light', 'rgba(255,150,175,0.6)'], clock: ['rgba(255,247,250,0.95)', 'rgba(255,198,214,0.55)'] },
      day: { tint: null, clock: ['rgba(255,255,255,0.95)', 'rgba(222,236,255,0.65)'] },
      dusk: { tint: ['soft-light', 'rgba(255,125,60,0.6)'], clock: ['rgba(255,242,236,0.95)', 'rgba(255,178,168,0.55)'] },
    };
    const TILE = 112, GAP = 26, DOCK_Y = 812, CARD_W = 300, CARD_H = 140, CARD_Y = 618;
    let scene = null, sceneKey = '', rsel = 0, dockOff = null, loaded = 0;

    const photo = new Image(), mask = new Image();
    [photo, mask].forEach(img => {
      img.onload = () => {
        loaded++;
        sceneKey = '';
      };
    });
    photo.src = 'img/horizon/mountains.jpg';
    mask.src = 'img/horizon/mountains-mask.png';

    function period(h) {
      if (h >= 20 || h < 5) return 'night';
      if (h < 8) return 'dawn';
      if (h < 17) return 'day';
      return 'dusk';
    }

    // Three layers: the tinted photo (behind the clock), its mountains alone (in front
    // of it), and a blurred copy for the glass. Plain teal until the photo has loaded.
    function build(name) {
      const s = SCENES[name], ready = loaded === 2;
      const back = makeCanvas(W, H, b => {
        if (!ready) {
          b.fillStyle = '#29464b';
          b.fillRect(0, 0, W, H);
          return;
        }
        b.drawImage(photo, 0, 0, W, H);
        if (s.tint) {
          b.globalCompositeOperation = s.tint[0];
          b.fillStyle = s.tint[1];
          b.fillRect(0, 0, W, H);
          b.globalCompositeOperation = 'source-over';
        }
        // Shade along the bottom so the dock reads.
        const shade = b.createLinearGradient(0, 560, 0, H);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.45)');
        b.fillStyle = shade;
        b.fillRect(0, 560, W, H - 560);
      });
      const front = makeCanvas(W, H, b => {
        if (!ready) return;
        b.drawImage(back, 0, 0);
        b.globalCompositeOperation = 'destination-in';
        b.drawImage(mask, 0, 0, W, H);
      });
      const blur = makeCanvas(W / 24, H / 24, b => {
        b.imageSmoothingQuality = 'high';
        b.drawImage(back, 0, 0, W / 24, H / 24);
      });
      return { s, back, front, blur };
    }

    function pill(g, text, x, y, on) {
      g.font = font(600, 26);
      const w = g.measureText(text).width + 48;
      if (on) {
        ICONS.rounded(g, x, y, w, 52, 26);
        g.fillStyle = 'rgba(255,255,255,0.92)';
        g.fill();
      } else glass(g, scene.blur, x, y, w, 52, 26);
      g.fillStyle = on ? '#16182b' : '#ffffff';
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(text, x + 24, y + 27);
      return w;
    }

    function shadowText(g, text, x, y) {
      g.shadowColor = 'rgba(0,0,0,0.35)';
      g.shadowBlur = 10;
      g.fillText(text, x, y);
      g.shadowBlur = 0;
    }

    function cards() {
      const recent = recentApps();
      return recent.length ? { label: 'Jump back in', apps: recent.slice(0, 4) } : { label: 'Try these', apps: ['youtube', 'flappy', 'wordle', 'trivia'].map(k => playableApps().find(a => a.key === k)).filter(Boolean) };
    }

    function draw(g) {
      const now = new Date();
      const p = period(now.getHours());
      if (sceneKey !== p) {
        scene = build(p);
        sceneKey = p;
      }
      g.drawImage(scene.back, 0, 0);

      // The clock, behind the peak.
      g.save();
      g.translate(W / 2, 560);
      g.scale(0.84, 1);
      g.font = font(200, 400);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      const ink = g.createLinearGradient(0, -300, 0, 0);
      ink.addColorStop(0, scene.s.clock[0]);
      ink.addColorStop(1, scene.s.clock[1]);
      g.fillStyle = ink;
      g.fillText(timeText(now, true), 0, 0);
      g.restore();
      g.drawImage(scene.front, 0, 0);

      // Date and weather above the clock.
      g.font = font(500, 30);
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      const date = DAY_NAMES[now.getDay()] + ' ' + now.getDate() + ' ' + MONTH_NAMES[now.getMonth()];
      const sky = weather ? weather.temp + '°   ' + skyWords(weather) : '';
      const dw = g.measureText(date).width, sw = weather ? g.measureText(sky).width + 56 : 0;
      let x = W / 2 - (dw + sw) / 2;
      g.textAlign = 'left';
      shadowText(g, date, x, 148);
      if (weather) {
        const ic = skyIcon(weather);
        drawIcon(g, ic, x + dw + 28, 148 - ic.length * 2, 4, '#ffffff');
        shadowText(g, sky, x + dw + 40 + ic[0].length * 4, 148);
      }

      // Who's here, and the room phones join.
      const pw = pill(g, CONFIG.name.charAt(0) + CONFIG.name.slice(1).toLowerCase(), 80, 64, true);
      pill(g, 'Room ' + ROOM, 80 + pw + 14, 64, false);
      glass(g, scene.blur, W - 132, 64, 52, 52, 26);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(W - 106, 90, 12, 0, Math.PI * 2);
      g.fill();
      if (p === 'night' || p === 'dusk') {
        g.fillStyle = 'rgba(70,74,120,1)';
        g.beginPath();
        g.arc(W - 100, 85, 11, 0, Math.PI * 2);
        g.fill();
      }

      // Recently opened, on glass cards.
      const c = cards();
      g.font = font(600, 28);
      g.fillStyle = '#ffffff';
      shadowText(g, c.label, 120, CARD_Y - 30);
      c.apps.forEach((app, i) => {
        const cx = 120 + i * (CARD_W + 24), on = focus === 'recent' && i === rsel;
        glass(g, scene.blur, cx, CARD_Y, CARD_W, CARD_H, 22, on ? 'rgba(255,255,255,0.34)' : null);
        if (on) {
          ICONS.rounded(g, cx - 4, CARD_Y - 4, CARD_W + 8, CARD_H + 8, 26);
          g.strokeStyle = '#ffffff';
          g.lineWidth = 4;
          g.stroke();
        }
        g.drawImage(ICONS.tile(app, 80), cx + 24, CARD_Y + 30);
        g.fillStyle = '#ffffff';
        g.font = font(600, 28);
        g.fillText(title(app.short), cx + 124, CARD_Y + 58);
        g.globalAlpha = 0.75;
        g.font = font(400, 22);
        g.fillText(kind(app), cx + 124, CARD_Y + 92);
        g.globalAlpha = 1;
      });

      // The dock, scrolled to keep the selected tile in view.
      const list = rows(), span = TILE + GAP, total = list.length * span - GAP, maxW = W - 280;
      const panelW = Math.min(total, maxW) + 48, panelX = (W - panelW) / 2;
      const want = total <= maxW ? 0 : Math.max(0, Math.min(total - maxW, sel * span - maxW / 2 + TILE / 2));
      dockOff = dockOff == null ? want : dockOff + (want - dockOff) * 0.2;
      glass(g, scene.blur, panelX, DOCK_Y, panelW, TILE + 40, 36, 'rgba(255,255,255,0.12)');
      g.save();
      ICONS.rounded(g, panelX, DOCK_Y - 80, panelW, TILE + 140, 36);
      g.clip();
      list.forEach((row, i) => {
        const tx = panelX + 24 + i * span - dockOff, on = focus === 'list' && i === sel;
        if (tx < panelX - TILE || tx > panelX + panelW) return;
        const size = on ? 124 : TILE, ty = DOCK_Y + 20 - (on ? 14 : 0);
        g.globalAlpha = row.child || !open || row.folder ? 1 : 0.55;
        g.drawImage(ICONS.tile(row.app, size), tx - (size - TILE) / 2, ty);
        g.globalAlpha = 1;
        if (on) {
          ICONS.rounded(g, tx - (size - TILE) / 2 - 5, ty - 5, size + 10, size + 10, 32);
          g.strokeStyle = '#ffffff';
          g.lineWidth = 4;
          g.stroke();
        }
      });
      g.restore();
      const row = list[sel];
      if (focus === 'list') {
        g.font = font(600, 26);
        g.textAlign = 'center';
        g.fillStyle = '#ffffff';
        const lx = Math.max(160, Math.min(W - 160, panelX + 24 + sel * span - dockOff + TILE / 2));
        shadowText(g, row.folder ? (open ? 'Games' : 'Games  ›') : title(row.app.name), lx, DOCK_Y - 32);
        g.textAlign = 'left';
      }

      // CONNECT PHONE: the QR code on its own card.
      if (row.connect && focus === 'list') {
        const qr = phoneQr(300);
        glass(g, scene.blur, W - 160 - qr.width - 40, CARD_Y - 300, qr.width + 40, qr.height + 110, 26);
        g.drawImage(qr, W - 160 - qr.width - 20, CARD_Y - 280);
        g.fillStyle = '#ffffff';
        g.font = font(500, 24);
        g.textAlign = 'center';
        g.fillText('Scan to use your phone', W - 160 - qr.width / 2 - 20, CARD_Y - 280 + qr.height + 46);
        g.textAlign = 'left';
      }

      Music.draw(g, focus === 'music');
    }

    // Up from the dock reaches the cards; Back or Down returns.
    function key(k) {
      const c = cards().apps;
      if (focus === 'recent') {
        if (k === 'left') rsel = Math.max(0, rsel - 1);
        else if (k === 'right') rsel = Math.min(c.length - 1, rsel + 1);
        else if (k === 'down') focus = 'list';
        else if (k === 'ok' && c[rsel]) activate({ app: c[rsel] });
        return true;
      }
      if (focus === 'list' && k === 'up') {
        if (c.length) {
          focus = 'recent';
          rsel = Math.min(rsel, c.length - 1);
        }
        return true;
      }
      return false;
    }

    return { axis: 'h', draw, key };
  })();

  // ---- Dial: a radio, with every app a station ------------------------------
  // After Dieter Rams' radios and clocks for Braun: a speaker grille, a clock with an
  // orange second hand, and a tuning scale that slides under a fixed needle.

  const dial = (() => {
    const PANEL = '#e8e5de', FACE = '#f6f5f1', INK = '#1d1c1a', GREY = '#77736b', ORANGE = '#ee6a1f';
    const STEP = 250, SCALE_X = 120, SCALE_Y = 690, SCALE_W = W - 240, SCALE_H = 170;
    const CLOCK_X = W - 310, CLOCK_Y = 360, CLOCK_R = 190, INFO_X = 860;

    const panel = makeCanvas(W, H, b => {
      const grad = b.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#efece6');
      grad.addColorStop(1, '#dcd8cf');
      b.fillStyle = grad;
      b.fillRect(0, 0, W, H);
      // The grille: holes punched in the panel, each with a lit lower lip.
      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 29; x++) {
          const cx = 132 + x * 22, cy = 242 + y * 22;
          b.fillStyle = 'rgba(255,255,255,0.75)';
          b.beginPath();
          b.arc(cx, cy + 1.2, 6, 0, Math.PI * 2);
          b.fill();
          b.fillStyle = '#2b2a27';
          b.beginPath();
          b.arc(cx, cy, 6, 0, Math.PI * 2);
          b.fill();
        }
      }
    });

    function knob(g, x, y, r, turn) {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = 18;
      g.shadowOffsetY = 6;
      const grad = g.createLinearGradient(x, y - r, x, y + r);
      grad.addColorStop(0, '#f4f2ed');
      grad.addColorStop(1, '#c9c4ba');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + Math.sin(turn) * r * 0.35, y - Math.cos(turn) * r * 0.35);
      g.lineTo(x + Math.sin(turn) * r * 0.8, y - Math.cos(turn) * r * 0.8);
      g.stroke();
    }

    function hand(g, angle, length, width, color) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(CLOCK_X - Math.sin(angle) * length * 0.16, CLOCK_Y + Math.cos(angle) * length * 0.16);
      g.lineTo(CLOCK_X + Math.sin(angle) * length, CLOCK_Y - Math.cos(angle) * length);
      g.stroke();
    }

    function drawClock(g, now) {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.18)';
      g.shadowBlur = 30;
      g.shadowOffsetY = 10;
      g.fillStyle = FACE;
      g.beginPath();
      g.arc(CLOCK_X, CLOCK_Y, CLOCK_R, 0, Math.PI * 2);
      g.fill();
      g.restore();
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2, hour = i % 5 === 0, r0 = CLOCK_R * (hour ? 0.8 : 0.88);
        g.strokeStyle = hour ? INK : GREY;
        g.lineWidth = hour ? 7 : 2;
        g.lineCap = 'butt';
        g.beginPath();
        g.moveTo(CLOCK_X + Math.sin(a) * r0, CLOCK_Y - Math.cos(a) * r0);
        g.lineTo(CLOCK_X + Math.sin(a) * CLOCK_R * 0.93, CLOCK_Y - Math.cos(a) * CLOCK_R * 0.93);
        g.stroke();
      }
      const s = now.getSeconds() + now.getMilliseconds() / 1000, m = now.getMinutes() + s / 60, h = now.getHours() % 12 + m / 60;
      hand(g, h / 12 * Math.PI * 2, CLOCK_R * 0.52, 12, INK);
      hand(g, m / 60 * Math.PI * 2, CLOCK_R * 0.78, 8, INK);
      hand(g, s / 60 * Math.PI * 2, CLOCK_R * 0.86, 3, ORANGE);
      g.fillStyle = ORANGE;
      g.beginPath();
      g.arc(CLOCK_X, CLOCK_Y, 9, 0, Math.PI * 2);
      g.fill();
    }

    function about(row) {
      if (row.folder) return open ? 'OK puts the games away' : 'OK tunes into ' + playableApps().filter(a => a.group === 'games').length + ' games';
      if (row.connect) return 'Remote, Spotify and games on your phone';
      if (row.settings) return 'Apps, design, clock';
      return kind(row.app);
    }

    function draw(g) {
      g.drawImage(panel, 0, 0);
      const now = new Date(), h = now.getHours();
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillStyle = INK;
      g.font = font(500, 40);
      const hello = h < 5 || h >= 18 ? 'Good evening' : h < 12 ? 'Good morning' : 'Good afternoon';
      g.fillText(hello + ', ' + title(CONFIG.name), 120, 150);

      drawClock(g, now);
      g.textAlign = 'center';
      g.font = font(500, 28);
      g.fillStyle = GREY;
      g.fillText(DAY_NAMES[now.getDay()] + ' ' + now.getDate() + ' ' + MONTH_NAMES[now.getMonth()], CLOCK_X, CLOCK_Y + CLOCK_R + 62);
      if (weather) {
        g.fillStyle = INK;
        g.fillText(weather.temp + '°  ' + skyWords(weather), CLOCK_X, CLOCK_Y + CLOCK_R + 100);
      }

      // What the needle is on.
      const list = rows(), row = list[sel];
      g.textAlign = 'left';
      let top = 250;
      if (row.connect) {
        const qr = phoneQr(260);
        g.drawImage(qr, INFO_X, 200);
        top = 200 + qr.height - 150;
      } else g.drawImage(ICONS.tile(row.app, 150), INFO_X, top);
      g.fillStyle = INK;
      g.font = font(600, 76);
      g.fillText(row.folder ? 'Games' : title(row.app.name), INFO_X, top + 250, CLOCK_X - CLOCK_R - INFO_X - 40);
      g.fillStyle = GREY;
      g.font = font(500, 30);
      g.fillText(about(row) + '  ·  ' + (88 + sel * 1.6).toFixed(1) + ' FM', INFO_X, top + 302);

      // The scale, slid so the picked station sits under the needle.
      g.save();
      ICONS.rounded(g, SCALE_X, SCALE_Y, SCALE_W, SCALE_H, 14);
      g.fillStyle = FACE;
      g.fill();
      g.clip();
      const mid = W / 2;
      for (let i = -1; i <= list.length; i++) {
        for (let k = 0; k < 5; k++) {
          const x = mid + (i - scrollPos + k / 5) * STEP;
          if (x < SCALE_X - 10 || x > SCALE_X + SCALE_W + 10) continue;
          const major = k === 0 && i >= 0 && i < list.length;
          g.fillStyle = major ? INK : '#b9b4aa';
          g.fillRect(x - (major ? 2 : 1), SCALE_Y + 18, major ? 4 : 2, major ? 46 : 22);
        }
      }
      g.textAlign = 'center';
      list.forEach((r, i) => {
        const x = mid + (i - scrollPos) * STEP;
        if (x < SCALE_X - STEP || x > SCALE_X + SCALE_W + STEP) return;
        g.fillStyle = GREY;
        g.font = font(500, 20);
        g.fillText((88 + i * 1.6).toFixed(1), x, SCALE_Y + 92);
        g.fillStyle = i === sel ? INK : GREY;
        g.font = font(i === sel ? 600 : 500, 28);
        g.fillText(r.folder ? 'Games' : title(r.app.short), x, SCALE_Y + 140, STEP - 20);
      });
      // The scale fades out at both ends, like the window of a real dial.
      [[SCALE_X, 1], [SCALE_X + SCALE_W, -1]].forEach(([x, d]) => {
        const fade = g.createLinearGradient(x, 0, x + d * 220, 0);
        fade.addColorStop(0, FACE);
        fade.addColorStop(1, 'rgba(246,245,241,0)');
        g.fillStyle = fade;
        g.fillRect(Math.min(x, x + d * 220), SCALE_Y, 220, SCALE_H);
      });
      g.restore();
      ICONS.rounded(g, SCALE_X + 0.5, SCALE_Y + 0.5, SCALE_W - 1, SCALE_H - 1, 14);
      g.strokeStyle = '#c8c3b9';
      g.lineWidth = 2;
      g.stroke();
      g.save();
      g.shadowColor = 'rgba(238,106,31,0.55)';
      g.shadowBlur = 14;
      // Down to the ticks, so the station names under it stay readable.
      g.fillStyle = focus === 'list' ? ORANGE : '#c9a48c';
      g.fillRect(mid - 3, SCALE_Y - 16, 6, 92);
      g.restore();

      knob(g, W - 360, 975, 40, 0.6);
      knob(g, W - 200, 975, 56, scrollPos * 0.7);
      g.textAlign = 'left';
      Music.draw(g, focus === 'music');
    }

    return { axis: 'h', draw };
  })();

  // ---- Panorama: words too big for the screen --------------------------------
  // After the Zune HD and Windows Phone: the section names run off the edge and slide
  // past as you go left and right; the lists are plain words.

  const panorama = (() => {
    const LIST_X = 110, LIST_Y = 500, ROW_H = 96, SHOWN = 5;
    let cat = 0, strip = 0, catAt = 0, items = {}, glowAt = 0, glowKey = '';

    function draw(g) {
      const m = menu();
      cat = Math.min(cat, m.length - 1);
      const c = m[cat], i = Math.min(items[c.key] || 0, c.items.length - 1), it = c.items[i];
      const now = new Date();

      g.fillStyle = '#060608';
      g.fillRect(0, 0, W, H);
      // A glow in the colour of whatever's picked, rising in as it changes.
      const key = it.app.key;
      if (key !== glowKey) {
        glowKey = key;
        glowAt = clock;
      }
      const glow = g.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, 950);
      const [r, gr, b] = hexRgb(it.app.color === '#F4F6F8' ? '#5b6cff' : it.app.color);
      const a = 0.42 * Math.min(1, (clock - glowAt) * 2.5);
      glow.addColorStop(0, 'rgba(' + r + ',' + gr + ',' + b + ',' + a + ')');
      glow.addColorStop(1, 'rgba(' + r + ',' + gr + ',' + b + ',0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);

      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = font(700, 22);
      g.globalAlpha = 0.7;
      g.fillText('B O N I T O', 112, 92);
      g.globalAlpha = 1;
      g.textAlign = 'right';
      g.font = font(300, 46);
      g.fillText(timeText(now), W - 110, 100);
      g.font = font(400, 24);
      g.globalAlpha = 0.65;
      g.fillText(DAY_NAMES[now.getDay()] + ' ' + now.getDate() + ' ' + MONTH_NAMES[now.getMonth()] + (weather ? '   ' + weather.temp + '° ' + skyWords(weather).toLowerCase() : ''), W - 110, 140);
      g.globalAlpha = 1;

      // The section names in one long strip, the picked one at the left edge.
      g.textAlign = 'left';
      g.font = font(200, 250);
      const starts = [];
      let x = 0;
      m.forEach(s => {
        starts.push(x);
        x += g.measureText(s.name.toLowerCase()).width + 110;
      });
      strip += (starts[cat] - strip) * 0.14;
      m.forEach((s, j) => {
        g.globalAlpha = j === cat ? 1 : 0.22;
        g.fillText(s.name.toLowerCase(), 96 + starts[j] - strip, 380);
      });
      g.globalAlpha = 1;

      // The list slides in from the right when the section changes.
      const t = Math.min(1, (clock - catAt) * 3.5), ease = 1 - Math.pow(1 - t, 3);
      const top = Math.max(0, Math.min(i - 2, c.items.length - SHOWN));
      g.save();
      g.translate((1 - ease) * 140, 0);
      g.globalAlpha = ease;
      c.items.slice(top, top + SHOWN).forEach((row, j) => {
        const on = top + j === i && focus === 'list', y = LIST_Y + j * ROW_H;
        g.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.42)';
        g.font = font(on ? 400 : 300, 64);
        g.fillText(row.connect ? 'connect phone' : row.settings ? 'settings' : title(row.app.name).toLowerCase(), LIST_X, y);
      });
      g.restore();

      // The picked app's tile, or the phone code.
      if (it.connect) {
        const qr = phoneQr(340);
        g.drawImage(qr, W - 150 - qr.width, 470);
      } else if (!it.settings) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.5)';
        g.shadowBlur = 50;
        g.shadowOffsetY = 20;
        g.drawImage(ICONS.tile(it.app, 300), W - 450, 470);
        g.restore();
      }

      Music.draw(g, focus === 'music');
    }

    function key(k) {
      if (focus !== 'list') return false;
      const m = menu(), c = m[cat], i = Math.min(items[c.key] || 0, c.items.length - 1);
      if (k === 'left' || k === 'right') {
        const next = Math.max(0, Math.min(m.length - 1, cat + (k === 'left' ? -1 : 1)));
        if (next !== cat) catAt = clock;
        cat = next;
      } else if (k === 'up') items[c.key] = Math.max(0, i - 1);
      else if (k === 'down' && i === c.items.length - 1) { if (Music.enabled()) focus = 'music'; }
      else if (k === 'down') items[c.key] = i + 1;
      else if (k === 'ok') activate(c.items[i]);
      else return false;
      return true;
    }

    return { draw, key };
  })();

  // ---- Media bar: categories across, items down, on a moving wave -----------
  // After the game console menus of the late 2000s.

  const mediabar = (() => {
    const CAT_X = 400, CAT_Y = 210, CAT_GAP = 250, ITEM_Y = 420, ITEM_H = 108;
    const isApp = r => !r.folder && !r.child && !r.connect && !r.settings;
    let cat = 0, catPos = 0;
    const item = {}, itemPos = {};

    function wave(g) {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, design.bg[0]);
      grad.addColorStop(1, design.bg[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.lineWidth = 1.5;
      for (let r = 0; r < 2; r++) {
        for (let l = 0; l < 14; l++) {
          g.strokeStyle = 'rgba(255,255,255,' + (0.08 + 0.03 * Math.sin(l)) + ')';
          g.beginPath();
          for (let x = 0; x <= W; x += 16) {
            const y = H * (0.62 + r * 0.08) + (90 - r * 30) * Math.sin(x * 0.0026 + clock * (0.25 + r * 0.1) + l * 0.07 + r * 2) + l * (5 + r * 3) * Math.sin(x * 0.0012 + clock * 0.2);
            if (x) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.stroke();
        }
      }
    }

    function draw(g) {
      wave(g);
      const m = menu();
      cat = Math.min(cat, m.length - 1);
      catPos += (cat - catPos) * 0.2;
      const now = new Date();

      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.font = font(300, 30);
      g.textAlign = 'right';
      g.fillText(now.getDate() + '/' + (now.getMonth() + 1) + '   ' + timeText(now), W - 110, 96);
      if (weather) {
        g.globalAlpha = 0.8;
        g.font = font(300, 24);
        g.fillText(weather.temp + '°  ' + skyWords(weather), W - 110, 136);
        g.globalAlpha = 1;
      }
      g.textAlign = 'left';

      m.forEach((c, i) => {
        const x = CAT_X + (i - catPos) * CAT_GAP, on = i === cat;
        const size = on ? 104 : 80;
        g.globalAlpha = on ? 1 : 0.55;
        g.drawImage(ICONS.glyph(c.key, size, '#ffffff'), x - size / 2, CAT_Y - size / 2);
        g.globalAlpha = 1;
        if (on) {
          g.font = font(400, 30);
          g.textAlign = 'center';
          g.fillText(c.name, x, CAT_Y + 90);
          g.textAlign = 'left';
        }
      });

      const c = m[cat], k = c.key;
      item[k] = Math.min(item[k] || 0, c.items.length - 1);
      itemPos[k] = itemPos[k] == null ? item[k] : itemPos[k] + (item[k] - itemPos[k]) * 0.22;
      c.items.forEach((it, i) => {
        const d = i - itemPos[k];
        // The selected item sits under the bar; ones before it move up above.
        const y = d >= 0 ? ITEM_Y + d * ITEM_H + (d > 0.5 ? 30 : d * 60) : CAT_Y - 140 + (d + 1) * ITEM_H * 0.8;
        if (y < 40 || y > H - 110) return;
        const on = i === item[k] && focus === 'list', size = on ? 100 : 72;
        g.globalAlpha = on ? 1 : d < 0 ? 0.35 : 0.75;
        g.drawImage(ICONS.tile(it.app, size), CAT_X - size / 2, y - size / 2);
        g.font = font(on ? 400 : 300, on ? 40 : 32);
        if (on) {
          g.shadowColor = 'rgba(255,255,255,0.9)';
          g.shadowBlur = 16;
        }
        g.fillText(it.folder ? 'Games' : title(it.app.name), CAT_X + 90, y - (on ? 14 : 0));
        g.shadowBlur = 0;
        if (on) {
          g.font = font(300, 24);
          g.globalAlpha = 0.8;
          g.fillText(it.connect ? 'Remote, Spotify and games on your phone' : it.settings ? 'Apps, design, clock' : kind(it.app), CAT_X + 90, y + 28);
        }
        g.globalAlpha = 1;
      });

      if (c.items[item[k]].connect) {
        const qr = phoneQr(380);
        g.drawImage(qr, W - 200 - qr.width, ITEM_Y - 60);
        g.font = font(300, 26);
        g.textAlign = 'center';
        g.fillText('Room ' + ROOM, W - 200 - qr.width / 2, ITEM_Y + qr.height - 20);
        g.textAlign = 'left';
      }

      Music.draw(g, focus === 'music');
    }

    function key(k) {
      if (focus !== 'list') return false;
      const m = menu(), c = m[cat], i = item[c.key] || 0;
      if (k === 'left') cat = Math.max(0, cat - 1);
      else if (k === 'right') cat = Math.min(m.length - 1, cat + 1);
      else if (k === 'up') item[c.key] = Math.max(0, i - 1);
      else if (k === 'down' && i === c.items.length - 1) { if (Music.enabled()) focus = 'music'; }
      else if (k === 'down') item[c.key] = i + 1;
      else if (k === 'ok') activate(c.items[i]);
      else return false;
      return true;
    }

    return { draw, key };
  })();

  // ---- Lakeside: apps floating on a mountain lake under the real sky ----------
  // The valley (js/landscape.js) is lit by the sun and moon where the TV is, and by its
  // weather.

  const lakeside = (() => {
    const SMALL = 104, BIG = 128, GAP = 40, BASE = 900, HEAD_H = 200, CLOCK_Y = 440;
    const mirrors = new WeakMap(), lift = {}, head = makeCanvas(W, HEAD_H, () => {}), face = makeCanvas(W, 330, () => {});
    let headKey = '', faceKey = '', dockOff = null;
    // The games folder opens as a panel over the dock rather than in the row.
    let pop = false, pick = 0, popT = 0;
    const games = () => playableApps().filter(a => a.group === 'games');

    // A tile's reflection: its lower half upside down, fading out. Keyed by the tile
    // canvas, which ICONS replaces once the app's logo has loaded.
    function mirror(tile) {
      let m = mirrors.get(tile);
      if (!m) {
        const s = tile.width, h = Math.round(s * 0.55);
        m = makeCanvas(s, h, b => {
          b.setTransform(1, 0, 0, -1, 0, s);
          b.drawImage(tile, 0, 0);
          b.setTransform(1, 0, 0, 1, 0, 0);
          b.globalCompositeOperation = 'destination-in';
          const fade = b.createLinearGradient(0, 0, 0, h);
          fade.addColorStop(0, 'rgba(0,0,0,0.38)');
          fade.addColorStop(1, 'rgba(0,0,0,0)');
          b.fillStyle = fade;
          b.fillRect(0, 0, s, h);
        });
        mirrors.set(tile, m);
      }
      return m;
    }

    // The launcher's own tiles (GAMES, HDMI, CONNECT PHONE, SETTINGS) as glass with white
    // line icons, instead of the pixel pictures, so they sit in the scene with the lake
    // showing through.
    const glyphs = {};
    function glyph(row, size) {
      const kind = row.folder ? 'games' : row.connect ? 'connect' : row.settings ? 'settings' : row.app.hdmi ? 'hdmi' : null;
      if (!kind) return null;
      const k = kind + '|' + size;
      if (!glyphs[k]) glyphs[k] = makeCanvas(size, size, b => {
        const s = size, c = s / 2;
        // Games and HDMI get colour from the scene (sunset, lake) so they sit with the app icons.
        const tone = kind === 'games' ? ['#ff9a62', '#d9487a'] : kind === 'hdmi' ? ['#26282e', '#08090b'] : null;
        ICONS.rounded(b, 0.75, 0.75, s - 1.5, s - 1.5, Math.round(s * 0.22));
        if (tone) {
          const bg = b.createLinearGradient(0, 0, s, s);
          bg.addColorStop(0, tone[0]);
          bg.addColorStop(1, tone[1]);
          b.fillStyle = bg;
          b.fill();
          const sheen = b.createLinearGradient(0, 0, 0, s * 0.6);
          sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
          sheen.addColorStop(1, 'rgba(255,255,255,0)');
          b.fillStyle = sheen;
          b.fill();
          b.fillStyle = bg;
        } else {
          b.fillStyle = 'rgba(255,255,255,0.16)';
          b.fill();
          b.strokeStyle = 'rgba(255,255,255,0.45)';
          b.lineWidth = 1.5;
          b.stroke();
        }
        const cut = b.fillStyle;
        b.fillStyle = b.strokeStyle = '#ffffff';
        b.lineWidth = s * 0.038;
        b.lineCap = b.lineJoin = 'round';
        b.textAlign = 'center';
        b.textBaseline = 'alphabetic';
        b.beginPath();
        if (kind === 'settings') {
          // A gear: eight teeth round a ring, with a hole.
          const out = s * 0.27, ring = s * 0.2, at = (a, r) => [c + Math.cos(a) * r, c + Math.sin(a) * r];
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            if (i) b.lineTo(...at(a - 0.24, ring));
            else b.moveTo(...at(a - 0.24, ring));
            b.lineTo(...at(a - 0.14, out));
            b.lineTo(...at(a + 0.14, out));
            b.lineTo(...at(a + 0.24, ring));
            b.arc(c, c, ring, a + 0.24, a + Math.PI / 4 - 0.24);
          }
          b.closePath();
          b.moveTo(c + s * 0.085, c);
          b.arc(c, c, s * 0.085, 0, Math.PI * 2, true);
          b.fill('evenodd');
        } else if (kind === 'hdmi') {
          // A laptop: aluminium lid round a dark screen (its picture is drawn live, see
          // laptopScreen), on a wider base with a thumb notch.
          const [sx, sy, sw, sh] = screenRect(s), bez = s * 0.022;
          ICONS.rounded(b, sx - bez, sy - bez, sw + bez * 2, sh + bez * 2, s * 0.035);
          b.fillStyle = '#c9cdd3';
          b.fill();
          b.fillStyle = '#0d0f13';
          b.fillRect(sx, sy, sw, sh);
          const bw = s * 0.74, by = sy + sh + bez;
          b.beginPath();
          b.moveTo(c - bw / 2, by);
          b.lineTo(c + bw / 2, by);
          b.lineTo(c + bw / 2 - s * 0.02, by + s * 0.045);
          b.lineTo(c - bw / 2 + s * 0.02, by + s * 0.045);
          b.closePath();
          b.fillStyle = '#e1e4e8';
          b.fill();
          b.fillStyle = '#8d929a';
          ICONS.rounded(b, c - s * 0.08, by, s * 0.16, s * 0.014, s * 0.007);
          b.fill();
        } else if (kind === 'games') {
          // A filled controller: body, two grips, then the d-pad and buttons cut back to the tile.
          const w = s * 0.6, h = s * 0.3, x = c - w / 2, y = c - h / 2 - s * 0.02;
          ICONS.rounded(b, x, y, w, h, h / 2);
          b.fill();
          b.beginPath();
          b.arc(x + w * 0.2, y + h * 0.78, h * 0.4, 0, Math.PI * 2);
          b.moveTo(x + w * 0.8 + h * 0.4, y + h * 0.78);
          b.arc(x + w * 0.8, y + h * 0.78, h * 0.4, 0, Math.PI * 2);
          b.fill();
          b.fillStyle = cut;
          const px = x + w * 0.26, py = y + h * 0.48, arm = s * 0.07, t = s * 0.028;
          b.fillRect(px - arm, py - t, arm * 2, t * 2);
          b.fillRect(px - t, py - arm, t * 2, arm * 2);
          b.beginPath();
          b.arc(x + w * 0.7, py + s * 0.035, s * 0.03, 0, Math.PI * 2);
          b.moveTo(x + w * 0.8 + s * 0.03, py - s * 0.035);
          b.arc(x + w * 0.8, py - s * 0.035, s * 0.03, 0, Math.PI * 2);
          b.fill();
        } else {
          const w = s * 0.26, h = s * 0.44;
          ICONS.rounded(b, c - w / 2, c - h / 2, w, h, s * 0.05);
          b.moveTo(c - s * 0.04, c + h / 2 - s * 0.06);
          b.lineTo(c + s * 0.04, c + h / 2 - s * 0.06);
          b.stroke();
        }
      });
      return glyphs[k];
    }

    // The laptop's screen within its tile, in tile pixels.
    function screenRect(s) {
      return [s * 0.23, s * 0.28, s * 0.54, s * 0.36];
    }

    // Its picture: soft colours drifting like a desktop wallpaper, drawn each frame over
    // the tile at x, y and `size`.
    function laptopScreen(g, x, y, size, alpha) {
      const [sx, sy, sw, sh] = screenRect(size), t = clock * 0.5;
      g.save();
      g.globalAlpha = alpha;
      g.beginPath();
      g.rect(x + sx, y + sy, sw, sh);
      g.clip();
      const bg = g.createLinearGradient(x + sx, y + sy, x + sx + sw, y + sy + sh);
      bg.addColorStop(0, '#1b2a6b');
      bg.addColorStop(1, '#5a1f6e');
      g.fillStyle = bg;
      g.fillRect(x + sx, y + sy, sw, sh);
      [['255,140,90', 0], ['90,170,255', 2.1], ['230,90,200', 4.2]].forEach(([rgb, phase]) => {
        const bx = x + sx + sw * (0.5 + 0.4 * Math.cos(t + phase)), by = y + sy + sh * (0.5 + 0.4 * Math.sin(t * 1.3 + phase));
        const blob = g.createRadialGradient(bx, by, 0, bx, by, sw * 0.6);
        blob.addColorStop(0, 'rgba(' + rgb + ',0.85)');
        blob.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = blob;
        g.fillRect(x + sx, y + sy, sw, sh);
      });
      g.restore();
    }

    // A small white picture of the weather, about 30px, centred on (x, y).
    function weatherIcon(b, w, x, y) {
      const c = w.code, snowy = (c >= 71 && c <= 77) || c === 85 || c === 86;
      b.lineWidth = 2.5;
      b.lineCap = 'round';
      b.beginPath();
      if (c < 2 && w.day) {
        b.arc(x, y, 6.5, 0, Math.PI * 2);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          b.moveTo(x + Math.cos(a) * 10.5, y + Math.sin(a) * 10.5);
          b.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
        }
        return b.stroke();
      }
      if (c < 2) {
        b.arc(x, y, 11, 0, Math.PI * 2);
        b.fill();
        // The crescent: a bite out of a full disc.
        b.save();
        b.globalCompositeOperation = 'destination-out';
        b.shadowColor = 'rgba(0,0,0,0)';
        b.beginPath();
        b.arc(x + 6, y - 4, 9.5, 0, Math.PI * 2);
        b.fill();
        return b.restore();
      }
      if (c >= 45 && c < 51) {
        [-7, 0, 7].forEach((d, i) => {
          b.moveTo(x - 13 + i * 3, y + d);
          b.lineTo(x + 13 - (2 - i) * 3, y + d);
        });
        return b.stroke();
      }
      const up = c >= 51 ? 5 : 0;
      [[-6, 2, 6.5], [2, -3, 8.5], [9, 3, 5.5]].forEach(([dx, dy, r]) => {
        b.moveTo(x + dx + r, y + dy - up);
        b.arc(x + dx, y + dy - up, r, 0, Math.PI * 2);
      });
      b.rect(x - 6, y + 2 - up, 15, 6.5);
      b.fill();
      if (c < 51) return;
      b.beginPath();
      for (let i = 0; i < 3; i++) {
        const px = x - 6 + i * 7;
        if (snowy) {
          b.moveTo(px + 1.8, y + 12);
          b.arc(px, y + 12, 1.8, 0, Math.PI * 2);
        } else {
          b.moveTo(px, y + 9);
          b.lineTo(px - 2.5, y + 15);
        }
      }
      if (snowy) b.fill();
      else b.stroke();
    }

    // The date and the weather, centred along the top. Drawn once a minute with their
    // soft shadows rather than every frame.
    function paintHead(now) {
      const b = head.getContext('2d'), y = 150;
      const date = DAY_NAMES[now.getDay()] + ', ' + MONTH_NAMES[now.getMonth()] + ' ' + now.getDate();
      b.clearRect(0, 0, W, HEAD_H);
      b.fillStyle = b.strokeStyle = '#ffffff';
      b.shadowColor = 'rgba(0,0,0,0.3)';
      b.shadowBlur = 16;
      b.textAlign = 'left';
      b.textBaseline = 'middle';
      b.font = font(500, 30);
      const sky = weather ? weather.temp + '°  ' + skyWords(weather) : '', dw = b.measureText(date).width;
      const x = (W - dw - (weather ? 74 + b.measureText(sky).width : 0)) / 2;
      b.fillText(date, x, y);
      if (!weather) return;
      weatherIcon(b, weather, x + dw + 55, y);
      b.fillText(sky, x + dw + 74, y);
    }

    // The clock, standing behind the mountains: white at the top, taking on the light of
    // the horizon toward its foot. Redrawn when the minute or the light changes.
    function paintFace(text, tint) {
      const b = face.getContext('2d');
      b.clearRect(0, 0, W, 330);
      b.font = font(200, 310);
      b.textAlign = 'center';
      b.textBaseline = 'alphabetic';
      const ink = b.createLinearGradient(0, 80, 0, 310);
      ink.addColorStop(0, 'rgba(255,255,255,0.95)');
      ink.addColorStop(1, tint);
      b.fillStyle = ink;
      b.shadowColor = 'rgba(0,0,0,0.12)';
      b.shadowBlur = 30;
      b.fillText(text, W / 2, 310);
    }

    function draw(g) {
      const now = new Date(Platform.now());
      Landscape.draw(g, weather, (b, tint) => {
        const t = timeText(now, true);
        if (t + tint !== faceKey) {
          faceKey = t + tint;
          paintFace(t, tint);
        }
        b.drawImage(face, 0, CLOCK_Y - 310);
      });
      const hk = Math.floor(now / 60e3) + (weather ? weather.temp + '/' + weather.code : '');
      if (hk !== headKey) {
        headKey = hk;
        paintHead(now);
      }
      g.drawImage(head, 0, 0);

      // The dock, scrolled to keep the selected tile in view, fading at its ends.
      const list = rows(), span = SMALL + GAP, total = list.length * span - GAP, room = Math.min(total, W - 400);
      const want = total <= room ? 0 : Math.max(0, Math.min(total - room, sel * span - room / 2 + SMALL / 2));
      dockOff = dockOff == null || Math.abs(want - dockOff) < 0.5 ? want : dockOff + (want - dockOff) * 0.2;
      const left = Math.round((W - room) / 2), mid = i => left + i * span + SMALL / 2 - dockOff;
      list.forEach((row, i) => {
        const k = row.app.key, on = focus === 'list' && i === sel, cx = mid(i);
        // Settles exactly, so a resting tile is drawn pixel for pixel and stays sharp.
        let t = lift[k] || 0;
        t += ((on ? 1 : 0) - t) * 0.22;
        if (Math.abs(t - (on ? 1 : 0)) < 0.02) t = on ? 1 : 0;
        lift[k] = t;
        const edge = Math.max(0, left + SMALL / 2 - cx, cx - (left + room - SMALL / 2));
        const alpha = Math.max(0, 1 - edge / 120) * (popT && !row.folder ? 1 - popT * 0.55 : 1);
        if (!alpha) return;
        const size = Math.round(SMALL + (BIG - SMALL) * t), up = Math.round(14 * t), x = Math.round(cx - size / 2), top = BASE - up - size;
        const tile = glyph(row, t > 0.3 ? BIG : SMALL) || ICONS.tile(row.app, t > 0.3 ? BIG : SMALL), m = mirror(tile), mh = size * 0.55;
        g.globalAlpha = alpha;
        // The reflection sits as far below the waterline as the tile floats above it,
        // in slices that sway like ripples.
        for (let j = 0; j < 4; j++) g.drawImage(m, 0, j * m.height / 4, m.width, m.height / 4, x + Math.sin(clock * 1.8 + j * 1.2 + i) * (j + 1) * 0.8, BASE + up + 4 + j * mh / 4, size, mh / 4);
        if (size === tile.width) g.drawImage(tile, x, top);
        else g.drawImage(tile, x, top, size, size);
        if (row.app.hdmi) laptopScreen(g, x, top, size, alpha);
        if (on) {
          g.save();
          g.globalAlpha = alpha * t;
          g.shadowColor = 'rgba(255,255,255,0.6)';
          g.shadowBlur = 18;
          ICONS.rounded(g, x - 6, top - 6, size + 12, size + 12, size * 0.22 + 6);
          g.strokeStyle = '#ffffff';
          g.lineWidth = 3.5;
          g.stroke();
          g.restore();
        }
      });
      g.globalAlpha = 1;

      const row = list[sel];
      g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = 14;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      if (focus === 'list' && !pop) {
        g.font = font(600, 30);
        g.fillText(row.folder ? 'Games  ›' : title(row.app.name), Math.max(160, Math.min(W - 160, mid(sel))), BASE - BIG - 40);
      }
      popT += ((pop ? 1 : 0) - popT) * 0.25;
      if (popT < 0.01) popT = 0;
      if (popT) folderPanel(g, mid(list.findIndex(r => r.folder)));
      g.fillStyle = '#ffffff';
      // CONNECT PHONE: the QR code, under the sun's arc.
      if (row.connect && focus === 'list') {
        const qr = phoneQr(300), qx = W - 112 - qr.width, qy = 300;
        g.drawImage(qr, qx, qy);
        g.font = font(500, 24);
        g.fillText('Scan with your phone', qx + qr.width / 2, qy + qr.height + 40);
        g.globalAlpha = 0.75;
        g.fillText('Room ' + ROOM, qx + qr.width / 2, qy + qr.height + 74);
        g.globalAlpha = 1;
      }
      g.shadowBlur = 0;
      g.textAlign = 'left';

      nowPlaying(g, focus === 'music', left);
    }

    // What's playing, in this design's type and set in from the edge: Spotify's logo, the
    // controls when the row is picked, then the song over its progress.
    // The games, listed in a panel that rises out of the folder's tile.
    function folderPanel(g, cx) {
      const list = games(), ROW = 76, PAD = 14, PW = 440, shown = Math.min(list.length, 7);
      const ph = shown * ROW + PAD * 2, x = Math.max(60, Math.min(W - 60 - PW, cx - PW / 2));
      const bottom = BASE - BIG - 34 + (1 - popT) * 24, top = bottom - ph;
      const first = Math.max(0, Math.min(list.length - shown, pick - shown + 1));
      g.save();
      g.globalAlpha = popT;
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = 40;
      g.fillStyle = 'rgba(16,20,32,0.82)';
      ICONS.rounded(g, x, top, PW, ph, 28);
      g.fill();
      g.beginPath();
      g.moveTo(cx - 16, bottom - 1);
      g.lineTo(cx, bottom + 15);
      g.lineTo(cx + 16, bottom - 1);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = 1.5;
      ICONS.rounded(g, x, top, PW, ph, 28);
      g.stroke();
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (let j = 0; j < shown; j++) {
        const app = list[first + j], y = top + PAD + j * ROW, on = first + j === pick;
        if (on) {
          g.fillStyle = 'rgba(255,255,255,0.16)';
          ICONS.rounded(g, x + 10, y + 2, PW - 20, ROW - 4, 18);
          g.fill();
        }
        g.drawImage(ICONS.tile(app, 56), x + 26, y + (ROW - 56) / 2);
        g.fillStyle = '#ffffff';
        g.globalAlpha = popT * (on ? 1 : 0.75);
        g.font = font(on ? 600 : 500, 28);
        g.fillText(title(app.name), x + 104, y + ROW / 2, PW - 130);
        g.globalAlpha = popT;
      }
      g.restore();
    }

    function key(k) {
      const row = rows()[sel];
      if (!pop) {
        if (k !== 'ok' || !row.folder) return false;
        pop = true;
        pick = 0;
        return true;
      }
      const n = games().length;
      if (k === 'up') pick = Math.max(0, pick - 1);
      else if (k === 'down') pick = Math.min(n - 1, pick + 1);
      else if (k === 'ok') {
        pop = false;
        activate({ app: games()[pick], child: true });
      } else pop = false;
      return true;
    }

    function back() {
      if (!pop) return false;
      pop = false;
      return true;
    }

    // Lined up with the dock's first tile, the progress looping round the logo.
    function nowPlaying(g, focused, left) {
      if (!Music.enabled()) return;
      const p = Music.now(), cy = 1010, logo = Music.logo(), cx = left + 31;
      if (logo) {
        g.globalAlpha = p.playing ? 1 : 0.6;
        g.drawImage(logo, cx - logo.width / 2, cy - logo.height / 2);
        g.globalAlpha = 1;
      }
      Music.ring(g, cx, cy);
      let x = cx + 31 + 24;
      if (focused) {
        ['prev', p.playing ? 'pause' : 'play', 'next', 'speaker'].forEach((kind, i) => Music.drawButton(g, kind, x + 26 + i * 64, cy, i === p.button));
        x += 4 * 64 + 20;
      }
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.4)';
      g.shadowBlur = 10;
      if (!p.track) {
        g.font = font(400, 24);
        g.globalAlpha = 0.7;
        g.fillText(p.status ? p.status.charAt(0) + p.status.slice(1).toLowerCase() : 'Spotify', x, cy, 900);
      } else {
        g.font = font(500, 28);
        g.globalAlpha = p.playing ? 1 : 0.7;
        const name = p.track.name.length > 40 ? p.track.name.slice(0, 38).trim() + '…' : p.track.name;
        g.fillText(name, x, cy);
        const nw = g.measureText(name).width;
        g.font = font(400, 26);
        g.globalAlpha *= 0.7;
        g.fillText('  ·  ' + p.track.artist + (focused ? '  ·  on ' + (p.speaker === 'tv' ? 'TV' : 'Echo Dot') : ''), x + nw, cy + 1);
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      g.textBaseline = 'alphabetic';
    }

    return { axis: 'h', draw, key, back };
  })();

  const LAYOUTS = { bonito, horizon, dial, panorama, mediabar, lakeside };
  const layout = () => LAYOUTS[design.key] || bonito;

  function enter() {
    focus = 'list';
    sel = Math.min(sel, rows().length - 1);
    scrollPos = sel;
    changed = clock;
    refreshWeather();
  }

  function update(dt) {
    // HDMI entries come and go while this screen is open.
    sel = Math.min(sel, rows().length - 1);
    scrollPos += (sel - scrollPos) * Math.min(1, dt * 12);
    refreshWeather();
  }

  function draw(g) {
    layout().draw(g);
  }

  function key(k, repeat, fromPhone) {
    const L = layout(), list = rows(), row = list[sel], before = sel;
    if (k === 'back') {
      if (L.back && L.back()) return;
      if (focus !== 'list') focus = 'list';
      else if (open) closeFolder();
      // A guest's phone can't open the launcher again, so it can't close it either.
      else if (!fromPhone) Platform.exit();
      return;
    }
    if (focus === 'music') {
      if (k === 'up') focus = 'list';
      else Music.key(k);
      return;
    }
    if (L.key && L.key(k)) return;
    const across = L.axis === 'h';
    if (k === (across ? 'left' : 'up')) sel = Math.max(0, sel - 1);
    else if (k === 'down' && (across || sel === list.length - 1)) { if (Music.enabled()) focus = 'music'; }
    else if (k === (across ? 'right' : 'down')) sel = Math.min(list.length - 1, sel + 1);
    else if (!across && k === 'left' && row.child) closeFolder();
    else if (k === 'ok') activate(row);
    if (sel !== before) changed = clock;
  }

  return { enter, update, draw, key };
})();
