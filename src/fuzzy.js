// Fuzzy subsequence matching with bonuses for consecutive and word-boundary hits.

export function isBoundary(text, i) {
  if (i === 0) return true;
  const p = text[i - 1];
  if (p === '/' || p === '-' || p === '_' || p === '.' || p === ' ') return true;
  const c = text[i];
  return p === p.toLowerCase() && c !== c.toLowerCase(); // camelCase hump
}

function restMatches(term, qi, lower, from) {
  for (; qi < term.length; qi++) {
    from = lower.indexOf(term[qi], from);
    if (from === -1) return false;
    from++;
  }
  return true;
}

// Returns {score, hits[]} or null. `term` must be lowercase; `lower` is text.toLowerCase().
export function matchTerm(term, text, lower = text.toLowerCase()) {
  let best = null;
  const sub = lower.indexOf(term);
  let tries = 0;
  for (let start = lower.indexOf(term[0]); start !== -1 && tries < 50; start = lower.indexOf(term[0], start + 1), tries++) {
    let score = 0;
    let prev = -1;
    const hits = [];
    let ok = true;
    for (let qi = 0; qi < term.length; qi++) {
      let j = qi === 0 ? start : lower.indexOf(term[qi], prev + 1);
      if (j === -1) { ok = false; break; }
      // Prefer a word-boundary occurrence if the greedy one isn't consecutive.
      if (qi > 0 && j !== prev + 1 && !isBoundary(text, j)) {
        let k = lower.indexOf(term[qi], j + 1);
        while (k !== -1 && !isBoundary(text, k)) k = lower.indexOf(term[qi], k + 1);
        if (k !== -1 && restMatches(term, qi + 1, lower, k + 1)) j = k;
      }
      let s = 1;
      if (j === prev + 1 && qi > 0) s += 6;
      if (isBoundary(text, j)) s += 4;
      if (qi > 0 && j > prev + 1) s -= Math.min(4, (j - prev - 1) * 0.3);
      score += s;
      hits.push(j);
      prev = j;
    }
    if (!ok) break; // later starts can't succeed if this one ran out of chars
    if (!best || score > best.score) best = { score, hits };
  }
  if (!best) return null;
  if (sub !== -1) {
    best.score += term.length * 2;
    if (isBoundary(text, sub)) best.score += 5;
  }
  best.score -= text.length * 0.02;
  return best;
}

// Repos need {n: full_name, d: description, t: pushed ms, a: archived, nl, dl (lowercased n/d)}.
// Returns [{r, score, hits}] best first; `hits` are indices into r.n.
export function search(repos, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return repos.slice().sort((a, b) => b.t - a.t).map((r) => ({ r, score: 0, hits: [] }));
  }
  const out = [];
  for (const r of repos) {
    let total = 0;
    const hits = [];
    let ok = true;
    for (const term of terms) {
      const nm = matchTerm(term, r.n, r.nl);
      const dm = r.d ? matchTerm(term, r.d, r.dl) : null;
      let s = -Infinity;
      if (nm) {
        s = nm.score;
        // Bonus when the match lands in the repo name rather than the owner.
        if (nm.hits[0] > r.n.indexOf('/')) s += 3;
      }
      if (dm && dm.score * 0.35 > s) s = dm.score * 0.35;
      else if (nm) hits.push(...nm.hits);
      if (s === -Infinity) { ok = false; break; }
      total += s;
    }
    if (!ok) continue;
    if (r.a) total -= 2;
    out.push({ r, score: total, hits });
  }
  out.sort((a, b) => b.score - a.score || b.r.t - a.r.t);
  return out;
}
