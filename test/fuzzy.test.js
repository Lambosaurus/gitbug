import { describe, it, expect } from 'vitest';
import { matchTerm, search, isBoundary } from '../src/fuzzy.js';

const mk = (n, extra = {}) => {
  const d = extra.d || '';
  return { id: n, n, d, t: 0, a: false, ...extra, nl: n.toLowerCase(), dl: d.toLowerCase() };
};
const names = (rs) => rs.map((x) => x.r.n);

describe('isBoundary', () => {
  it('detects separators and camelCase', () => {
    expect(isBoundary('a/b', 2)).toBe(true);
    expect(isBoundary('fooBar', 3)).toBe(true);
    expect(isBoundary('foobar', 3)).toBe(false);
  });
});

describe('matchTerm', () => {
  it('returns null when not a subsequence', () => {
    expect(matchTerm('xyz', 'abc')).toBeNull();
  });
  it('prefers word-boundary hits', () => {
    expect(matchTerm('fb', 'foo-bar').hits).toEqual([0, 4]);
  });
  it('does not jump to a boundary that would break the rest of the match', () => {
    // greedy 'b' at 1 works; jumping to boundary 'b' at 4 would leave no 'c' after it
    expect(matchTerm('abc', 'abc-b')).not.toBeNull();
  });
  it('scores contiguous substring above scattered match', () => {
    expect(matchTerm('core', 'core-utils').score).toBeGreaterThan(matchTerm('core', 'c-o-r-e').score);
  });
});

describe('search', () => {
  const repos = [
    mk('tlembedded/firmware-core', { t: 3 }),
    mk('acme/core-utils', { t: 1 }),
    mk('tlembedded/gitbug', { t: 5 }),
    mk('someorg/FirmwareUpdater', { t: 2 }),
    mk('x/random-thing', { d: 'firmware tooling', t: 4 }),
    mk('tlembedded/fw-bootloader', { t: 0 }),
  ];

  it('empty query sorts by most recent push', () => {
    expect(names(search(repos, '  '))[0]).toBe('tlembedded/gitbug');
  });
  it('acronym-style queries hit boundaries', () => {
    expect(names(search(repos, 'fw'))[0]).toBe('tlembedded/fw-bootloader');
    expect(names(search(repos, 'fu'))).toEqual(['someorg/FirmwareUpdater']);
    expect(names(search(repos, 'gb'))).toEqual(['tlembedded/gitbug']);
  });
  it('matches in the repo name beat matches in the owner', () => {
    expect(names(search(repos, 'core'))[0]).toBe('acme/core-utils');
  });
  it('multiple terms are ANDed', () => {
    expect(names(search(repos, 'firmware tl'))[0]).toBe('tlembedded/firmware-core');
    expect(names(search(repos, 'gitbug acme'))).toEqual([]);
  });
  it('falls back to description, ranked below name matches', () => {
    const r = names(search(repos, 'firm'));
    expect(r).toContain('x/random-thing');
    expect(r.at(-1)).toBe('x/random-thing');
  });
  it('penalises archived repos', () => {
    const rs = [mk('a/thing', { a: true }), mk('b/thing')];
    expect(names(search(rs, 'thing'))[0]).toBe('b/thing');
  });
});
