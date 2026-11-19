const API = 'https://api.github.com';

export class AuthError extends Error {}

export async function gh(url, token) {
  const r = await fetch(url.startsWith('http') ? url : API + url, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (r.status === 401) throw new AuthError('Token rejected (expired or revoked).');
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`GitHub ${r.status}: ${body.message || r.statusText}`);
  }
  return r;
}

export const REPOS_PATH = '/user/repos?per_page=100&sort=full_name&affiliation=owner,collaborator,organization_member';

export async function fetchAllRepos(token) {
  // Stable ordering so parallel page fetches don't skip/duplicate.
  const first = await gh(REPOS_PATH + '&page=1', token);
  const out = await first.json();
  const m = (first.headers.get('link') || '').match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  const last = m ? parseInt(m[1], 10) : 1;
  const pages = [];
  for (let p = 2; p <= last; p++) pages.push(gh(`${REPOS_PATH}&page=${p}`, token).then((r) => r.json()));
  for (const page of await Promise.all(pages)) out.push(...page);

  const seen = new Set();
  const slim = [];
  for (const r of out) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    slim.push({
      id: r.id,
      n: r.full_name,
      d: r.description || '',
      u: r.html_url,
      p: r.private,
      f: r.fork,
      a: r.archived,
      l: r.language || '',
      t: Date.parse(r.pushed_at || r.updated_at) || 0,
      o: r.owner && r.owner.avatar_url,
    });
  }
  return slim;
}
