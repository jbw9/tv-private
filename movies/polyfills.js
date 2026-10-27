// What Movies uses that Chromium 69 doesn't have (see legacy.js). Loaded first, older TVs only.
if (!String.prototype.matchAll) {
  String.prototype.matchAll = function (re) {
    const flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
    const r = new RegExp(re.source, flags), all = [];
    let m;
    while ((m = r.exec(this))) {
      all.push(m);
      if (!m[0]) r.lastIndex++;
    }
    return all[Symbol.iterator]();
  };
}
if (!Promise.allSettled) {
  Promise.allSettled = list => Promise.all(Array.from(list, p => Promise.resolve(p).then(
    value => ({ status: 'fulfilled', value }),
    reason => ({ status: 'rejected', reason }))));
}
