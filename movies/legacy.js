// Gives the Movies build a second copy of its scripts and styles for older TVs, picked when the
// page starts. 2020-21 Samsungs run Chromium 69-85, which can't parse ?. ?? ||=, and whose CSS
// lacks inset, clamp/min/max, :is/:has, aspect-ratio and flex gap. There the page loads
// assets/js-legacy (the scripts as ES2018, after polyfills.js and layout.js) and
// assets/css-legacy (sizes worked out for the TV's 1920x1080 screen). Newer TVs load the
// originals.
// Usage: node movies/legacy.js build/movies
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.argv[2];
const W = 1920, H = 1080, REM = 16;

// ---- scripts --------------------------------------------------------------------------------

const js = path.join(root, 'assets/js'), jsOut = path.join(root, 'assets/js-legacy');
fs.mkdirSync(jsOut, { recursive: true });
for (const f of fs.readdirSync(js).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(js, f), 'utf8');
  const { outputText } = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.None } });
  // Selectors in strings, for querySelectorAll and co., lose :is() like the stylesheets do.
  fs.writeFileSync(path.join(jsOut, f), outputText.replace(/(['"])((?:(?!\1)[^\\\n]|\\.)*:is\((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    (all, q, sel) => q + selectors(sel).join(', ') + q));
}
fs.copyFileSync(path.join(__dirname, 'polyfills.js'), path.join(jsOut, 'polyfills.js'));

// ---- styles ---------------------------------------------------------------------------------

// Splits on `sep` outside brackets.
function split(s, sep) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && !depth) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

// The function call starting at `i` (at its name): [name, args text, index after the `)`].
function call(s, i) {
  const open = s.indexOf('(', i);
  let depth = 0, j = open;
  for (; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')' && !--depth) break;
  }
  return [s.slice(i, open), s.slice(open + 1, j), j + 1];
}

// A length in px, or null if it depends on something only the page knows (%, em, var()).
function px(expr) {
  expr = expr.trim();
  const fn = /^(calc|min|max|clamp)\(/.exec(expr);
  if (fn) {
    const [name, args, end] = call(expr, 0);
    if (end !== expr.length) return sum(expr);
    if (name === 'calc') return sum(args);
    const vals = split(args, ',').map(px);
    if (vals.some(v => v === null)) return null;
    if (name === 'min') return Math.min(...vals);
    if (name === 'max') return Math.max(...vals);
    return Math.min(Math.max(vals[0], vals[1]), vals[2]);
  }
  return sum(expr);
}

// + - * / over numbers, px, rem, vw, vh, vmin, vmax and nested calls.
function sum(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if ('+-*/()'.includes(c) && !(c === '-' && /[\d.]/.test(expr[i + 1] || '') && (!tokens.length || typeof tokens[tokens.length - 1] === 'string' && tokens[tokens.length - 1] !== ')'))) {
      tokens.push(c); i++; continue;
    }
    const f = /^(calc|min|max|clamp)\(/.exec(expr.slice(i));
    if (f) {
      const [, , end] = call(expr, i);
      const v = px(expr.slice(i, end));
      if (v === null) return null;
      tokens.push({ v, unit: true }); i = end; continue;
    }
    const m = /^(-?[\d.]+)(px|rem|vw|vh|vmin|vmax)?/.exec(expr.slice(i));
    if (!m) return null;
    const n = parseFloat(m[1]);
    const per = { px: 1, rem: REM, vw: W / 100, vh: H / 100, vmin: Math.min(W, H) / 100, vmax: Math.max(W, H) / 100 }[m[2]];
    tokens.push({ v: m[2] ? n * per : n, unit: !!m[2] });
    i += m[0].length;
  }
  let p = 0;
  const atom = () => {
    const t = tokens[p++];
    if (t === '(') { const v = add(); p++; return v; }
    if (t === '-') { const v = atom(); return { v: -v.v, unit: v.unit }; }
    return t;
  };
  const mul = () => {
    let a = atom();
    while (tokens[p] === '*' || tokens[p] === '/') {
      const op = tokens[p++], b = atom();
      a = op === '*' ? { v: a.v * b.v, unit: a.unit || b.unit } : { v: a.v / b.v, unit: a.unit };
    }
    return a;
  };
  const add = () => {
    let a = mul();
    while (tokens[p] === '+' || tokens[p] === '-') {
      const op = tokens[p++], b = mul();
      a = { v: op === '+' ? a.v + b.v : a.v - b.v, unit: a.unit || b.unit };
    }
    return a;
  };
  try {
    const r = add();
    return r && p === tokens.length && typeof r.v === 'number' && isFinite(r.v) ? r.v : null;
  } catch (e) {
    return null;
  }
}

const round = v => +v.toFixed(2) + 'px';

// min/max/clamp in a value become a px size for the TV, or failing that the argument most
// likely to fit: clamp's preferred size, min's cap, or max's flexible size.
function value(v) {
  let out = '', i = 0;
  for (;;) {
    const m = /\b(min|max|clamp)\(/.exec(v.slice(i));
    if (!m) return out + v.slice(i);
    const at = i + m.index;
    const [name, args, end] = call(v, at);
    out += v.slice(i, at);
    const whole = px(v.slice(at, end));
    if (whole !== null) out += round(whole);
    else {
      const parts = split(args, ',').map(a => value(a.trim()));
      const fixed = parts.map(px).filter(v => v !== null);
      const pick = name === 'clamp' ? parts[1]
        : name === 'min' && fixed.length ? round(Math.min(...fixed))
        : parts.find(a => px(a) === null) || parts[0];
      out += /[-+*/]\s/.test(pick) && !/^calc\(/.test(pick) ? `calc(${pick})` : pick;
    }
    i = end;
  }
}

// `a:is(b, c) d` -> `a b d, a c d`; selectors with :has or :focus-visible are dropped, which
// in a list would otherwise take the whole rule down with them.
function selectors(list) {
  const out = [];
  for (let sel of split(list, ',')) {
    sel = sel.trim();
    const at = sel.indexOf(':is(');
    if (at >= 0) {
      const [, args, end] = call(sel, at + 1);
      split(args, ',').forEach(a => out.push(...selectors(sel.slice(0, at) + a.trim() + sel.slice(end))));
    } else if (!/:has\(|:focus-visible/.test(sel)) out.push(sel);
  }
  return out;
}

const ratios = [];
function declarations(body, sels) {
  return split(body, ';').map(d => {
    const c = d.indexOf(':');
    if (c < 0) return d;
    const prop = d.slice(0, c).trim(), v = d.slice(c + 1).trim();
    if (prop === 'aspect-ratio') {
      const [w, h = '1'] = v.replace('!important', '').split('/').map(Number);
      ratios.push([sels.join(','), isNaN(w) ? 0 : w / h]);
      return d;
    }
    if (prop === 'inset') {
      const imp = /!important/.test(v) ? ' !important' : '';
      const [t, r = t, b = t, l = r] = value(v.replace('!important', '')).trim().split(/\s+/);
      return `top:${t}${imp};right:${r}${imp};bottom:${b}${imp};left:${l}${imp}`;
    }
    return /\b(min|max|clamp)\(/.test(v) ? `${prop}:${value(v)}` : d;
  }).join(';');
}

function css(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return text.replace(/([^{}]+)\{([^{}]*)\}/g, (all, sel, body) => {
    const lead = sel.match(/^\s*/)[0];
    sel = sel.trim();
    // @font-face and keyframe steps keep their heads.
    const keep = sel[0] === '@' || /^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(sel);
    const sels = keep ? [sel] : selectors(sel);
    if (!sels.length) return lead;
    return `${lead}${sels.join(',')}{${declarations(body, sels)}}`;
  });
}

const cssDir = path.join(root, 'assets/css'), cssOut = path.join(root, 'assets/css-legacy');
fs.mkdirSync(cssOut, { recursive: true });
const sheets = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
for (const f of sheets) fs.writeFileSync(path.join(cssOut, f), css(fs.readFileSync(path.join(cssDir, f), 'utf8')));
fs.writeFileSync(path.join(jsOut, 'layout.js'), `window.RATIOS = ${JSON.stringify(ratios)};\n` + fs.readFileSync(path.join(__dirname, 'layout.js'), 'utf8'));

// ---- the page -------------------------------------------------------------------------------

// The stylesheet links and script tags each become one loader that writes them back in the
// same order, from the original folders or the legacy ones. aspect-ratio arrived in Chromium 88,
// after everything else above.
const html = path.join(root, 'index.html');
let page = fs.readFileSync(html, 'utf8');
const links = [], scripts = [];
page = page.replace(/^\s*<link rel="stylesheet" href="assets\/css\/([\w-]+)\.css">\n/gm, (_, name) => {
  links.push(name);
  return links.length === 1 ? '__LINKS__\n' : '';
});
page = page.replace(/^\s*<script src="assets\/js\/([\w-]+)\.js"><\/script>\n/gm, (_, name) => {
  scripts.push(name);
  return scripts.length === 1 ? '__SCRIPTS__\n' : '';
});
if (!links.length || !scripts.length) throw new Error("index.html's stylesheets or scripts weren't found");
const pick = "window.LEGACY = /[?&]legacy=1/.test(location.search) || !(window.CSS && CSS.supports && CSS.supports('aspect-ratio: 1'));";
page = page.replace('__LINKS__', `    <script>${pick} ${JSON.stringify(links)}.forEach(function (n) { document.write('<link rel="stylesheet" href="assets/css' + (LEGACY ? '-legacy/' : '/') + n + '.css">'); });</script>`);
page = page.replace('__SCRIPTS__', `    <script>(LEGACY ? ['polyfills', 'layout'] : []).concat(${JSON.stringify(scripts)}).forEach(function (n) { document.write('<script src="assets/js' + (LEGACY ? '-legacy/' : '/') + n + '.js"><\\/script>'); });</script>`);
fs.writeFileSync(html, page);
console.log(`Movies: ${scripts.length} scripts and ${links.length} stylesheets, with an older-browser copy`);
