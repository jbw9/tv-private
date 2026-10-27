// Older TVs only (see legacy.js): what Chromium 69's layout leaves out. Flex `gap` is parsed
// there but only spaces grids, so flex children get it as margins instead; and boxes sized by
// `aspect-ratio` (posters, stills, the player) get their height set from their width.
// window.RATIOS, written by legacy.js, lists [selector, width / height or 0 for auto] in
// stylesheet order.
(() => {
  const ratios = window.RATIOS || [];
  const flowing = el => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
  };

  function gaps(els) {
    const writes = [];
    els.forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display !== 'flex' && cs.display !== 'inline-flex') return;
      const col = parseFloat(cs.columnGap) || 0, row = parseFloat(cs.rowGap) || 0;
      if (!col && !row) return;
      const dir = cs.flexDirection, wrap = cs.flexWrap !== 'nowrap';
      let first = true;
      Array.prototype.forEach.call(el.children, kid => {
        if (!flowing(kid)) return;
        const side = { row: 'marginLeft', 'row-reverse': 'marginRight', column: 'marginTop', 'column-reverse': 'marginBottom' }[dir];
        if (wrap) {
          // Wrapping rows: space after every item, so each line lines up on the left.
          writes.push([kid, 'marginRight', col], [kid, 'marginBottom', row]);
        } else if (first) {
          // Was further along before something in front of it went away.
          if (kid.dataset.gap) writes.push([kid, side, null]);
        } else if (!parseFloat(getComputedStyle(kid)[side]) || kid.dataset.gap) {
          // A child's own margin (like margin-left: auto) stays.
          writes.push([kid, side, dir.indexOf('row') === 0 ? col : row]);
        }
        first = false;
      });
    });
    writes.forEach(([kid, side, px]) => {
      kid.style[side] = px === null ? '' : px + 'px';
      kid.dataset.gap = '1';
    });
  }

  function shapes(els) {
    const sized = [];
    els.forEach(el => {
      let r = null;
      ratios.forEach(([sel, ratio]) => { if (el.matches(sel)) r = ratio; });
      if (r !== null) sized.push([el, r]);
    });
    const heights = sized.map(([el, r]) => r ? el.getBoundingClientRect().width / r : 0);
    sized.forEach(([el, r], i) => {
      if (!r) el.style.height = '';
      else if (heights[i]) el.style.height = heights[i] + 'px';
    });
  }

  // Changes are gathered and handled once per frame: everything read, then everything written.
  let pending = new Set(), queued = false;
  function run() {
    queued = false;
    const roots = Array.from(pending).filter(n => n.isConnected);
    pending = new Set();
    const els = new Set();
    roots.forEach(n => {
      els.add(n);
      if (n.parentElement) els.add(n.parentElement);
      n.querySelectorAll('*').forEach(e => els.add(e));
    });
    const list = Array.from(els);
    gaps(list);
    shapes(list);
  }
  function queue(n) {
    if (n.nodeType !== 1) n = n.parentElement;
    if (!n) return;
    pending.add(n);
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  }

  new MutationObserver(list => list.forEach(m => {
    if (m.type === 'attributes') return queue(m.target);
    m.addedNodes.forEach(queue);
    // Something removed can leave a new first child, which mustn't keep a gap.
    if (m.removedNodes.length) queue(m.target);
  })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  queue(document.body);
  addEventListener('resize', () => queue(document.body));
})();
