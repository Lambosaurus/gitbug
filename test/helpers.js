import { vi } from 'vitest';

export function apiRepo(id, full_name, extra = {}) {
  return {
    id,
    full_name,
    description: null,
    html_url: `https://github.com/${full_name}`,
    private: false,
    fork: false,
    archived: false,
    language: null,
    pushed_at: '2026-01-01T00:00:00Z',
    owner: { avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4` },
    ...extra,
  };
}

// Mock fetch that serves /user and paginated /user/repos from `all`.
export function mockGitHub(all, { perPage = 100, status = 200 } = {}) {
  const fn = vi.fn(async (url, opts) => {
    if (status !== 200) return new Response(JSON.stringify({ message: 'nope' }), { status });
    const u = new URL(url);
    if (u.pathname === '/user') return Response.json({ login: 'me' });
    if (u.pathname === '/user/repos') {
      const page = Number(u.searchParams.get('page') || 1);
      const pages = Math.max(1, Math.ceil(all.length / perPage));
      const headers = {};
      if (pages > 1) {
        const base = `https://api.github.com/user/repos?per_page=${perPage}`;
        headers.link = `<${base}&page=${Math.min(page + 1, pages)}>; rel="next", <${base}&page=${pages}>; rel="last"`;
      }
      return Response.json(all.slice((page - 1) * perPage, page * perPage), { headers });
    }
    return new Response('not found', { status: 404 });
  });
  globalThis.fetch = fn;
  return fn;
}
