import { describe, it, expect } from 'vitest';
import { fetchAllRepos, AuthError } from '../src/github.js';
import { apiRepo, mockGitHub } from './helpers.js';

describe('fetchAllRepos', () => {
  it('fetches all pages in parallel and slims the result', async () => {
    const all = Array.from({ length: 250 }, (_, i) => apiRepo(i, `org/repo-${i}`));
    const fetch = mockGitHub(all);
    const repos = await fetchAllRepos('tok');
    expect(repos).toHaveLength(250);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetch.mock.calls[0][0]).toContain('affiliation=owner,collaborator,organization_member');
    expect(repos[0]).toMatchObject({ id: 0, n: 'org/repo-0', u: 'https://github.com/org/repo-0', d: '' });
  });

  it('dedupes repos that appear on two pages', async () => {
    mockGitHub([apiRepo(1, 'a/x'), apiRepo(1, 'a/x'), apiRepo(2, 'a/y')], { perPage: 2 });
    expect((await fetchAllRepos('tok')).map((r) => r.id)).toEqual([1, 2]);
  });

  it('throws AuthError on 401', async () => {
    mockGitHub([], { status: 401 });
    await expect(fetchAllRepos('bad')).rejects.toBeInstanceOf(AuthError);
  });

  it('surfaces other API errors with the message', async () => {
    mockGitHub([], { status: 403 });
    await expect(fetchAllRepos('tok')).rejects.toThrow('GitHub 403: nope');
  });
});
