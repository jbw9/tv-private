// The scenery behind the Lakeside home screen (js/home.js): a lake in a mountain valley,
// drawn in code and lit by where the sun and moon really are for the TV's place and time,
// so it goes through night, dawn, day and sunset as the sky outside does. Clouds, rain,
// snow and fog follow the weather.
const Landscape = (() => {
  const RAD = Math.PI / 180, DAY = 86400e3;
  const WATER = 728; // the far shore: the lake mirrors what's above it
  const STEP = 8, N = 256; // ridge points, 8px apart, to a little past the right edge
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14), MONTH = 29.530588853 * DAY;
  const MOON = [244, 241, 232];

  // Seeded, so the valley is the same on every TV and every start.
  let seed = 11;
  function rnd() {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const css = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + (a == null ? 1 : a) + ')';

  // Heights along a ridge: random detail (midpoint displacement, `rough` px at the
  // largest scale and `smooth` times less at each halving) over bumps that place the
  // peaks, each [x as a share of the width, height, width], pointed at the top.
  function ridge(base, bumps, rough, smooth) {
    const d = [];
    for (let i = 0; i <= N; i++) d.push(0);
    for (let s = N, a = rough; s > 1; s /= 2, a *= smooth) {
      for (let i = s / 2; i < N; i += s) d[i] = (d[i - s / 2] + d[i + s / 2]) / 2 + (rnd() * 2 - 1) * a;
    }
    return d.map((n, i) => base - n - bumps.reduce((h, b) => h + b[1] * Math.exp(-Math.pow(Math.abs(i * STEP / W - b[0]) / b[2], 1.3)), 0));
  }

  function at(line, x) {
    const i = Math.max(0, Math.min(N - 1, Math.floor(x / STEP))), f = x / STEP - i;
    return line[i] + (line[i + 1] - line[i]) * f;
  }

  // The hills either side of the lake, rising from the water to the screen's edges.
  function hills() {
    return ridge(0, [], 10, 0.62).map((d, i) => {
      const x = i * STEP, l = Math.max(0, 1 - x / 560), r = Math.max(0, 1 - (W - x) / 500);
      const h = Math.max(250 * l * l * (3 - 2 * l), 215 * r * r * (3 - 2 * r));
      return WATER - h - d * Math.min(1, h / 60);
    });
  }

  // Pines standing on a ridge, `gap` px apart on average: [x, ground, height].
  function forest(line, gap, tall) {
    const out = [];
    for (let x = rnd() * gap; x < W + 20; x += gap * (0.5 + rnd())) {
      const h = tall(x) * (0.6 + rnd() * 0.7);
      if (h > 4) out.push([x, at(line, x) + 2, h]);
    }
    return out;
  }

  function pine(b, x, y, h) {
    const w = h * 0.3;
    b.moveTo(x, y - h);
    b.lineTo(x + w * 0.45, y - h * 0.55);
    b.lineTo(x + w * 0.25, y - h * 0.55);
    b.lineTo(x + w * 0.75, y - h * 0.2);
    b.lineTo(x + w * 0.5, y - h * 0.2);
    b.lineTo(x + w, y);
    b.lineTo(x - w, y);
    b.lineTo(x - w * 0.5, y - h * 0.2);
    b.lineTo(x - w * 0.75, y - h * 0.2);
    b.lineTo(x - w * 0.25, y - h * 0.55);
    b.lineTo(x - w * 0.45, y - h * 0.55);
    b.closePath();
  }

  // Far to near. depth: how far each is from the haze toward the land's own colour.
  const LAYERS = [
    // The tallest peak in the middle, in front of the clock.
    { depth: 0.16, line: ridge(590, [[0.5, 225, 0.075], [0.6, 110, 0.045], [0.29, 140, 0.065], [0.07, 70, 0.06], [0.9, 90, 0.06]], 56, 0.68) },
    { depth: 0.36, line: ridge(642, [[0.4, 115, 0.1], [0.8, 90, 0.08], [0.02, 60, 0.06]], 40, 0.64) },
    { depth: 0.56, line: ridge(684, [[0.14, 70, 0.1], [0.64, 50, 0.12], [0.96, 40, 0.06]], 22, 0.6) },
    { depth: 0.75, line: ridge(716, [], 8, 0.6) },
    { depth: 0.92, line: hills() },
  ];
  LAYERS[0].snow = ridge(462, [], 30, 0.8);
  LAYERS[2].trees = forest(LAYERS[2].line, 7, () => 12);
  LAYERS[3].trees = forest(LAYERS[3].line, 6, () => 22);
  LAYERS[4].trees = forest(LAYERS[4].line, 12, x => {
    const h = WATER - at(LAYERS[4].line, x);
    return h < 4 ? 0 : 30 + h * 0.18;
  });
  LAYERS.forEach(l => {
    l.tall = Math.max(0, ...(l.trees || []).map(t => t[2]));
    l.top = Math.min(...l.line) - l.tall;
  });

  // The open sky's lower edge at x, so stars stay off the mountains.
  function skyline(x) {
    return Math.min(...LAYERS.map(l => at(l.line, x) - l.tall)) - 6;
  }

  const STARS = [];
  while (STARS.length < 230) {
    const x = rnd() * W, y = Math.pow(rnd(), 1.3) * 640, top = skyline(x);
    if (y > top) continue;
    STARS.push({ x, y, s: rnd() < 0.07 ? 2.6 : 1.1 + rnd(), a: (0.35 + rnd() * 0.65) * Math.min(1, (top - y) / 180 + 0.25), tw: 0.6 + rnd() * 2.4, ph: rnd() * 7 });
  }

  // Sparkles in the path of light the sun or moon lays on the water: u across it, v down.
  const GLINTS = Array.from({ length: 90 }, () => ({ u: rnd() + rnd() - 1, v: rnd(), len: 14 + rnd() * 40, sp: 1.5 + rnd() * 3, ph: rnd() * 7 }));
  // Faint lines of wind on the water: [x, y, length].
  const STREAKS = Array.from({ length: 36 }, () => {
    const v = rnd();
    return [rnd() * W, WATER + 6 + v * v * (H - WATER), 60 + rnd() * 420 * (0.4 + v)];
  });

  // Night: fireflies along the shore, and the brighter low stars mirrored in the lake.
  const FLIES = Array.from({ length: 34 }, () => ({ x: rnd() * W, y: 630 + rnd() * 140, ph: rnd() * 7, sp: 0.6 + rnd() * 1.2, r: 0.7 + rnd() * 0.6 }));
  const DEEP = STARS.filter(p => p.y > 2 * WATER - H + 10 && p.a > 0.4);
  const GLOW = makeCanvas(32, 32, b => {
    const r = b.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,250,190,1)');
    r.addColorStop(0.25, 'rgba(230,255,140,0.55)');
    r.addColorStop(1, 'rgba(200,255,120,0)');
    b.fillStyle = r;
    b.fillRect(0, 0, 32, 32);
  });

  // Puffy clouds and long thin ones, soft at the edges. puffs: circles [x, -, r] along
  // a base, or ellipses [x, y, rx, ry] for the thin ones.
  const CLOUD_PAD = 30;
  const CLOUDS = Array.from({ length: 10 }, () => {
    const streak = rnd() < 0.35, w = Math.round(streak ? 320 + rnd() * 380 : 240 + rnd() * 260), h = Math.round(streak ? 44 : w * 0.3);
    const puffs = [];
    if (streak) for (let i = 0; i < 3; i++) puffs.push([w * (0.35 + rnd() * 0.3), 12 + i * 9, w * (0.2 + rnd() * 0.13), 6 + rnd() * 4]);
    else for (let x = 0.12; x < 0.88; x += 0.06 + rnd() * 0.07) puffs.push([x * w, 0, h * (0.14 + 0.42 * Math.pow(Math.sin(Math.PI * x), 1.5) * (0.55 + rnd() * 0.45))]);
    return { streak, w, h, puffs, x: rnd() * W, y: 50 + rnd() * (250 - h), speed: 4 + rnd() * 8 };
  });

  // The light by the sun's altitude in degrees: sky top, middle and horizon, the haze on
  // far mountains, the nearest land, the lake, cloud tops and undersides, snow, the sun
  // and the glow around it, how strong that glow is, and how many stars show.
  const LIGHT = [
    { alt: -18, top: '#03050d', mid: '#080c1e', low: '#111833', haze: '#151c38', land: '#020409', water: '#02040a', cloud: '#0e1328', under: '#161d38', snow: '#3c4560', sun: '#ffd9a0', glow: '#1c2448', glowA: 0, stars: 1 },
    { alt: -10, top: '#060b22', mid: '#121a40', low: '#262c5a', haze: '#272d58', land: '#04060e', water: '#040711', cloud: '#171c3e', under: '#272b55', snow: '#4b5276', sun: '#ffd0a0', glow: '#4b3f80', glowA: 0.2, stars: 0.85 },
    { alt: -5, top: '#0f1d48', mid: '#2e3670', low: '#7a5788', haze: '#55497a', land: '#0b0b1c', water: '#0a0d20', cloud: '#2a2a57', under: '#6b4c7c', snow: '#8a7a9e', sun: '#ff9b6a', glow: '#c15e7c', glowA: 0.45, stars: 0.35 },
    { alt: -1.5, top: '#19306a', mid: '#5b5292', low: '#f08a6c', haze: '#a1688c', land: '#181326', water: '#141429', cloud: '#4a3f70', under: '#f08c76', snow: '#e0a0a8', sun: '#ff8a50', glow: '#ff7448', glowA: 0.8, stars: 0.08 },
    { alt: 3, top: '#264987', mid: '#8f75a3', low: '#ffae7a', haze: '#d4928a', land: '#24192e', water: '#211d36', cloud: '#7a6290', under: '#ffbc90', snow: '#ffd0bc', sun: '#ffb070', glow: '#ff9a52', glowA: 0.85, stars: 0 },
    { alt: 9, top: '#3468b0', mid: '#86a8d2', low: '#ffd9a8', haze: '#c3b6b0', land: '#243237', water: '#28404f', cloud: '#f3e7e8', under: '#ffd4ab', snow: '#fff0e4', sun: '#ffe2b0', glow: '#ffcf8a', glowA: 0.5, stars: 0 },
    { alt: 22, top: '#3676cb', mid: '#73aae3', low: '#cfe6f5', haze: '#a7c5da', land: '#1b382f', water: '#274e69', cloud: '#ffffff', under: '#d9e4ef', snow: '#f6fafd', sun: '#fffaf0', glow: '#fff2d8', glowA: 0.32, stars: 0 },
    { alt: 60, top: '#2c6ac6', mid: '#68a4e4', low: '#c6e2f6', haze: '#9fc1dc', land: '#1a3a30', water: '#25506f', cloud: '#ffffff', under: '#dce7f1', snow: '#ffffff', sun: '#ffffff', glow: '#fff6e6', glowA: 0.3, stars: 0 },
  ].map(k => {
    const o = {};
    Object.keys(k).forEach(f => { o[f] = typeof k[f] === 'string' ? hexRgb(k[f]) : k[f]; });
    return o;
  });

  // `grey` (0-1) washes the colour out for an overcast sky.
  function light(alt, grey) {
    let i = 0;
    while (i < LIGHT.length - 2 && alt > LIGHT[i + 1].alt) i++;
    const a = LIGHT[i], b = LIGHT[i + 1], t = Math.max(0, Math.min(1, (alt - a.alt) / (b.alt - a.alt))), L = {};
    Object.keys(a).forEach(k => {
      if (typeof a[k] === 'number') L[k] = a[k] + (b[k] - a[k]) * t;
      else {
        const c = lerp(a[k], b[k], t), y = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) * 0.85;
        L[k] = lerp(c, [y, y, y], grey * 0.7);
      }
    });
    L.glowA *= 1 - grey;
    L.stars *= 1 - grey;
    return L;
  }

  // Open-Meteo's weather codes as clouds, rain, snow and fog.
  function conditions(code) {
    if (code == null) return { clouds: 3, grey: 0 };
    if (code >= 95) return { clouds: 10, grey: 0.8, rain: 240 };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { clouds: 10, grey: 0.55, snow: 170 };
    if (code >= 61) return { clouds: 10, grey: 0.65, rain: 170 };
    if (code >= 51) return { clouds: 9, grey: 0.55, rain: 70 };
    if (code >= 45) return { clouds: 3, grey: 0.45, fog: true };
    return [{ clouds: 1, grey: 0 }, { clouds: 3, grey: 0 }, { clouds: 6, grey: 0.1 }, { clouds: 10, grey: 0.45 }][Math.min(3, code)];
  }

  // ---- where the sun and moon are ---------------------------------------------

  // The sun's ecliptic longitude in degrees.
  function sunLng(ms) {
    const d = ms / DAY - 10957.5, g = (357.529 + 0.98560028 * d) * RAD;
    return 280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  }

  // Altitude (degrees) and hour angle (radians, 0 = due south) of a body on the ecliptic.
  function position(ms, lng, lat, lon) {
    const d = ms / DAY - 10957.5, e = (23.439 - 4e-7 * d) * RAD, l = lng * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)), dec = Math.asin(Math.sin(e) * Math.sin(l));
    const h = (280.46061837 + 360.98564736629 * d + lon) * RAD - ra, ha = Math.atan2(Math.sin(h), Math.cos(h));
    return { alt: Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD, ha };
  }

  // Until the weather says where the TV is: its time zone's longitude, at 40°N.
  const GUESS = (() => {
    const y = new Date().getFullYear();
    return { lat: 40, lon: -Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset()) / 4 };
  })();

  // Everything that only changes by the minute.
  function situate(ms, at, code) {
    const south = at.lat < 0;
    const body = lng => {
      const p = position(ms, lng, at.lat, at.lon);
      return { alt: p.alt, x: W / 2 + Math.sin(p.ha) * 660 * (south ? -1 : 1), y: 560 - 500 * Math.sin(Math.max(-10, p.alt) * RAD) };
    };
    const phase = (((ms - NEW_MOON) / MONTH) % 1 + 1) % 1, sun = body(sunLng(ms)), moon = body(sunLng(ms) + phase * 360);
    moon.phase = phase;
    moon.lit = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    moon.right = (phase < 0.5) !== south;
    const wx = conditions(code), L = light(sun.alt, wx.grey);
    // For whatever the home screen puts between sky and land: white lit by the horizon.
    return { sun, moon, wx, L, tint: css(lerp(L.low, [255, 255, 255], 0.45), 0.6) };
  }

  // ---- the picture ------------------------------------------------------------

  // The sky, and the land and lake in front of it, kept apart so the home screen's
  // clock can stand between them, behind the mountains.
  const sky = makeCanvas(W, WATER, () => {}), land = makeCanvas(W, H, () => {}), mirror = makeCanvas(W, H - WATER, () => {});
  let sprites = [];

  function drawSun(b, s) {
    const p = s.sun, c = s.L.sun, a = 1 - s.wx.grey;
    const halo = b.createRadialGradient(p.x, p.y, 0, p.x, p.y, 220);
    halo.addColorStop(0, css(c, 0.55 * a));
    halo.addColorStop(0.2, css(c, 0.22 * a));
    halo.addColorStop(1, css(c, 0));
    b.fillStyle = halo;
    b.fillRect(p.x - 220, p.y - 220, 440, 440);
    b.fillStyle = css(c, a);
    b.beginPath();
    b.arc(p.x, p.y, 38, 0, Math.PI * 2);
    b.fill();
  }

  // The moon in its real phase, paler by day.
  function drawMoon(b, s) {
    const p = s.moon, r = 26, day = Math.max(0, Math.min(1, (s.sun.alt + 6) / 10));
    const a = (1 - 0.55 * day) * (1 - s.wx.grey * 0.9), k = Math.cos(p.phase * 2 * Math.PI);
    if (day < 1) {
      const halo = b.createRadialGradient(p.x, p.y, r, p.x, p.y, r * 5);
      halo.addColorStop(0, css(MOON, 0.16 * a * (1 - day)));
      halo.addColorStop(1, css(MOON, 0));
      b.fillStyle = halo;
      b.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10);
    }
    b.fillStyle = css(MOON, 0.07 * a);
    b.beginPath();
    b.arc(p.x, p.y, r, 0, Math.PI * 2);
    b.fill();
    // The lit edge, then back along the line between light and dark.
    b.fillStyle = css(MOON, a);
    b.beginPath();
    b.arc(p.x, p.y, r, -Math.PI / 2, Math.PI / 2, !p.right);
    b.ellipse(p.x, p.y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, p.right ? k > 0 : k < 0);
    b.fill();
  }

  // The shape is drawn off the canvas so only its blurred shadow lands, for soft edges,
  // then coloured lit on top and shaded under.
  function cloud(c, L) {
    const P = CLOUD_PAD;
    return makeCanvas(c.w + P * 2, c.h + P * 2, b => {
      b.shadowColor = '#000';
      b.shadowBlur = c.streak ? 14 : 20;
      b.shadowOffsetX = 10000;
      b.translate(P - 10000, P);
      b.beginPath();
      if (c.streak) c.puffs.forEach(p => {
        b.moveTo(p[0] + p[2], p[1]);
        b.ellipse(p[0], p[1], p[2], p[3], 0, 0, Math.PI * 2);
      });
      else {
        c.puffs.forEach(p => {
          const y = c.h - 2 - p[2] * 0.5;
          b.moveTo(p[0] + p[2], y);
          b.arc(p[0], y, p[2], 0, Math.PI * 2);
        });
        b.moveTo(c.w * 0.92, c.h - c.h * 0.16);
        b.ellipse(c.w / 2, c.h - c.h * 0.16, c.w * 0.42, c.h * 0.14, 0, 0, Math.PI * 2);
      }
      b.fill();
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.shadowColor = 'rgba(0,0,0,0)';
      b.globalCompositeOperation = 'source-in';
      const grad = b.createLinearGradient(0, P, 0, P + c.h);
      grad.addColorStop(0, css(L.cloud));
      grad.addColorStop(1, css(L.under));
      b.fillStyle = grad;
      b.fillRect(0, 0, c.w + P * 2, c.h + P * 2);
    });
  }

  function paint(s) {
    const a = sky.getContext('2d'), b = land.getContext('2d'), L = s.L;
    const fill = a.createLinearGradient(0, 0, 0, WATER);
    fill.addColorStop(0, css(L.top));
    fill.addColorStop(0.55, css(L.mid));
    fill.addColorStop(1, css(L.low));
    a.fillStyle = fill;
    a.fillRect(0, 0, W, WATER);
    // The sun lights the sky around it, even from just below the horizon.
    if (L.glowA > 0.01) {
      const y = Math.min(s.sun.y, 700), glow = a.createRadialGradient(s.sun.x, y, 0, s.sun.x, y, 1000);
      glow.addColorStop(0, css(L.glow, L.glowA));
      glow.addColorStop(0.3, css(L.glow, L.glowA * 0.4));
      glow.addColorStop(1, css(L.glow, 0));
      a.fillStyle = glow;
      a.fillRect(0, 0, W, WATER);
    }
    if (s.moon.alt > -3) drawMoon(a, s);
    if (s.sun.alt > -3 && s.wx.grey < 0.5) drawSun(a, s);

    b.clearRect(0, 0, W, H);
    LAYERS.forEach(l => {
      const c = lerp(L.haze, L.land, l.depth), grad = b.createLinearGradient(0, l.top, 0, WATER);
      grad.addColorStop(0, css(c));
      grad.addColorStop(1, css(lerp(c, L.low, 0.28)));
      b.fillStyle = grad;
      b.beginPath();
      b.moveTo(0, WATER);
      l.line.forEach((y, i) => b.lineTo(i * STEP, y));
      b.lineTo(N * STEP, WATER);
      b.closePath();
      (l.trees || []).forEach(t => pine(b, t[0], t[1], t[2]));
      b.fill();
      if (!l.snow) return;
      b.save();
      b.clip();
      b.fillStyle = css(L.snow, 0.85);
      b.beginPath();
      b.moveTo(0, 0);
      l.snow.forEach((y, i) => b.lineTo(i * STEP, y));
      b.lineTo(N * STEP, 0);
      b.closePath();
      b.fill();
      b.restore();
    });
    if (s.wx.fog) {
      const fog = b.createLinearGradient(0, 420, 0, WATER);
      fog.addColorStop(0, css(L.low, 0));
      fog.addColorStop(1, css(L.low, 0.75));
      b.fillStyle = fog;
      b.fillRect(0, 420, W, WATER - 420);
    }

    // The lake: everything above, upside down, rippled, darker toward the viewer.
    const m = mirror.getContext('2d');
    m.setTransform(1, 0, 0, -1, 0, H - WATER);
    m.drawImage(sky, 0, 2 * WATER - H, W, H - WATER, 0, 0, W, H - WATER);
    m.drawImage(land, 0, 2 * WATER - H, W, H - WATER, 0, 0, W, H - WATER);
    m.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = css(L.water);
    b.fillRect(0, WATER, W, H - WATER);
    for (let y = 0; y < H - WATER; y += 2) b.drawImage(mirror, 0, y, W, 2, Math.sin(y * 0.35) * (1 + y * 0.012) - 8, WATER + y, W + 16, 2);
    const tint = b.createLinearGradient(0, WATER, 0, H);
    tint.addColorStop(0, css(L.water, 0.25));
    tint.addColorStop(1, css(L.water, 0.8));
    b.fillStyle = tint;
    b.fillRect(0, WATER, W, H - WATER);
    b.fillStyle = css(L.low, 0.1);
    STREAKS.forEach(r => b.fillRect(r[0] - r[2] / 2, r[1], r[2], 2));
    b.fillStyle = css(L.low, 0.3);
    b.fillRect(0, WATER, W, 1);

    sprites = CLOUDS.map(c => cloud(c, L));
  }

  // ---- what moves ---------------------------------------------------------------

  let state = null, key = '', last = null, flock = null, nextFlock = 12, meteor = null, nextMeteor = 6, plane = null, nextPlane = 25;
  const drops = [], flakes = [];

  function glitter(g, x, color, strength) {
    g.fillStyle = css(color);
    GLINTS.forEach(p => {
      const a = Math.sin(clock * p.sp + p.ph);
      if (a < 0.3) return;
      g.globalAlpha = strength * (a - 0.3) / 0.7;
      g.fillRect(x + p.u * (30 + p.v * 260) - p.len / 2, WATER + 4 + p.v * p.v * (H - WATER - 8), p.len * (0.5 + p.v), 2 + p.v * 2);
    });
    g.globalAlpha = 1;
  }

  function birds(g, dt, L) {
    if (!flock) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      flock = { dir, x: dir > 0 ? -60 : W + 60, y: 150 + Math.random() * 200, birds: [] };
      for (let i = 0, n = 3 + Math.floor(Math.random() * 4); i < n; i++) flock.birds.push({ dx: -i * 34 - Math.random() * 14, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 16 + Math.random() * 8, ph: Math.random() * 7, s: 0.8 + Math.random() * 0.4 });
    }
    flock.x += flock.dir * 85 * dt;
    g.strokeStyle = css(lerp(L.land, [0, 0, 0], 0.4), 0.7);
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    flock.birds.forEach(b => {
      const x = flock.x + b.dx * flock.dir, y = flock.y + b.dy + Math.sin(clock * 0.7 + b.ph) * 3;
      const flap = Math.sin(clock * 8 + b.ph) * 5 * b.s, w = 9 * b.s;
      g.moveTo(x - w, y - flap);
      g.quadraticCurveTo(x - w * 0.4, y - 2, x, y + 1);
      g.quadraticCurveTo(x + w * 0.4, y - 2, x + w, y - flap);
    });
    g.stroke();
    if (flock.x * flock.dir > (flock.dir > 0 ? W + 260 : 260)) {
      flock = null;
      nextFlock = clock + 45 + Math.random() * 75;
    }
  }

  function shootingStar(g, dt, stars) {
    if (!meteor) meteor = { x: 300 + Math.random() * 1300, y: 50 + Math.random() * 200, t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
    meteor.t += dt;
    const p = Math.min(1, meteor.t / 0.9), hx = meteor.x + meteor.dir * 700 * meteor.t, hy = meteor.y + 300 * meteor.t;
    const tail = 160 * Math.sin(Math.PI * p), grad = g.createLinearGradient(hx, hy, hx - meteor.dir * tail * 0.92, hy - tail * 0.39);
    grad.addColorStop(0, 'rgba(255,255,255,' + 0.9 * stars * Math.sin(Math.PI * p) + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx - meteor.dir * tail * 0.92, hy - tail * 0.39);
    g.stroke();
    if (p >= 1) {
      meteor = null;
      nextMeteor = clock + 8 + Math.random() * 22;
    }
  }

  // Each blinks on and off as it wanders, with a faint copy in the water below.
  function fireflies(g, dark) {
    g.globalCompositeOperation = 'lighter';
    FLIES.forEach(f => {
      const pulse = Math.sin(clock * f.sp + f.ph);
      if (pulse < 0.2) return;
      const x = f.x + Math.sin(clock * 0.21 + f.ph) * 60, y = f.y + Math.sin(clock * 0.37 + f.ph * 1.7) * 18, size = 26 * f.r;
      g.globalAlpha = dark * Math.pow((pulse - 0.2) / 0.8, 2);
      g.drawImage(GLOW, x - size / 2, y - size / 2, size, size);
      if (y < WATER - 4) {
        g.globalAlpha *= 0.35;
        g.drawImage(GLOW, x - size / 2, 2 * WATER - y - size * 0.3, size, size * 0.6);
      }
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function starsInLake(g, dark) {
    g.fillStyle = '#ffffff';
    DEEP.forEach(p => {
      g.globalAlpha = dark * p.a * 0.35 * (0.5 + 0.5 * Math.sin(clock * p.tw * 1.6 + p.ph));
      g.fillRect(p.x + Math.sin(clock * 1.5 + p.y) * 2, 2 * WATER - p.y, p.s * 1.6, p.s * 0.8);
    });
    g.globalAlpha = 1;
  }

  // A plane high up, crossing slowly with its light blinking.
  function airplane(g, dt, dark) {
    if (!plane) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      plane = { dir, x: dir > 0 ? -20 : W + 20, y: 90 + Math.random() * 160 };
    }
    plane.x += plane.dir * 38 * dt;
    plane.y -= dt * 2;
    g.fillStyle = 'rgba(255,255,255,' + 0.75 * dark + ')';
    g.fillRect(plane.x - 1.5, plane.y - 1.5, 3, 3);
    if (clock % 1.4 < 0.15) {
      g.fillStyle = 'rgba(255,80,80,' + dark + ')';
      g.beginPath();
      g.arc(plane.x - plane.dir * 6, plane.y + 1, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    if (plane.x < -40 || plane.x > W + 40) {
      plane = null;
      nextPlane = clock + 60 + Math.random() * 90;
    }
  }

  function rain(g, n, dt, L) {
    while (drops.length < n) drops.push({ x: Math.random() * (W + 200), y: Math.random() * H, len: 18 + Math.random() * 22, sp: 900 + Math.random() * 500 });
    g.strokeStyle = css(lerp(L.low, [255, 255, 255], 0.4), 0.35);
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      d.y += d.sp * dt;
      d.x -= d.sp * dt * 0.12;
      if (d.y > H + d.len) {
        d.y = -d.len;
        d.x = Math.random() * (W + 200);
      }
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + d.len * 0.12, d.y - d.len);
    }
    g.stroke();
  }

  function snow(g, n, dt) {
    while (flakes.length < n) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 2.5, sp: 40 + Math.random() * 60, ph: Math.random() * 7 });
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const d = flakes[i];
      d.y += d.sp * dt;
      d.x += Math.sin(clock * 0.8 + d.ph) * 20 * dt;
      if (d.y > H + 5) {
        d.y = -5;
        d.x = Math.random() * W;
      }
      g.moveTo(d.x + d.r, d.y);
      g.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    g.fill();
  }

  // `w`: the home screen's weather, which also says where the TV is. `behind(g, tint)`
  // draws in front of the sky and clouds but behind the mountains.
  let seen = null; // the last weather home passed in, for still()
  function draw(g, w, behind) {
    seen = w;
    const ms = Platform.now(), at = w && w.lat != null ? w : GUESS, code = w ? w.code : null;
    const k = Math.floor(ms / 60e3) + '|' + code + '|' + at.lat + ',' + at.lon;
    if (k !== key) {
      key = k;
      state = situate(ms, at, code);
      paint(state);
    }
    const s = state, L = s.L, dt = last == null ? 0 : Math.min(0.1, clock - last);
    last = clock;
    g.drawImage(sky, 0, 0);

    if (L.stars > 0.02) {
      g.fillStyle = '#ffffff';
      STARS.forEach(p => {
        if (s.moon.alt > -3 && Math.abs(p.x - s.moon.x) < 50 && Math.abs(p.y - s.moon.y) < 50) return;
        g.globalAlpha = L.stars * p.a * (0.55 + 0.45 * Math.sin(clock * p.tw + p.ph));
        g.fillRect(p.x, p.y, p.s, p.s);
      });
      g.globalAlpha = 1;
      if (meteor || (clock > nextMeteor && L.stars > 0.6)) shootingStar(g, dt, L.stars);
      if (plane || (clock > nextPlane && L.stars > 0.4)) airplane(g, dt, L.stars);
    }
    for (let i = 0; i < s.wx.clouds; i++) {
      const c = CLOUDS[i], span = W + c.w + 200;
      g.drawImage(sprites[i], ((c.x + c.w + 100 + clock * c.speed) % span) - c.w - 100 - CLOUD_PAD, c.y - CLOUD_PAD);
    }
    if (behind) behind(g, s.tint);
    g.drawImage(land, 0, 0);
    if (s.sun.alt > -1 && s.sun.alt < 30) glitter(g, s.sun.x, L.sun, (1 - s.sun.alt / 30) * (1 - s.wx.grey) * 0.85);
    else if (s.sun.alt < -4 && s.moon.alt > 0) glitter(g, s.moon.x, MOON, 0.55 * s.moon.lit * (1 - s.wx.grey));
    if (L.stars > 0.3) {
      starsInLake(g, L.stars * (1 - s.wx.grey));
      if (!s.wx.rain && !s.wx.snow) fireflies(g, L.stars);
    }
    if (flock || (clock > nextFlock && s.sun.alt > 3 && !s.wx.rain && !s.wx.snow)) birds(g, dt, L);
    if (s.wx.rain) rain(g, s.wx.rain, dt, L);
    if (s.wx.snow) snow(g, s.wx.snow, dt);
  }

  // The scene small and still, for other screens to stretch into a soft background.
  function still() {
    return makeCanvas(W / 8, H / 8, b => {
      b.scale(1 / 8, 1 / 8);
      draw(b, seen, () => {});
    });
  }

  return { draw, still };
})();
