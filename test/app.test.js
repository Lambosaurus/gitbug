import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiRepo, mockGitHub } from './helpers.js';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const $ = (id) => document.getElementById(id);
const titles = () => [...document.querySelectorAll('#list a')].map((a) => a.querySelector('.title').textContent);
const type = (q) => { $('q').value = q; $('q').dispatchEvent(new Event('input')); };
const key = (k, opts = {}) => $('q').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));

async function boot() {
  vi.resetModules();
  await import('../src/main.js');
}

const REPOS = [
  apiRepo(1, 'tlembedded/gitbug', { private: true, pushed_at: '2026-11-01T00:00:00Z' }),
  apiRepo(2, 'acme/core-utils', { description: 'Shared helpers', pushed_at: '2026-10-01T00:00:00Z' }),
  apiRepo(3, 'tlembedded/fw-bootloader', { archived: true, pushed_at: '2026-09-01T00:00:00Z' }),
];

beforeEach(() => {
  document.body.innerHTML = body;
  localStorage.clear();
  window.scrollTo = () => {};
});

describe('app', () => {
  it('shows login without a token, then lists repos after sign-in', async () => {
    const fetch = mockGitHub(REPOS);
    await boot();
    expect($('login').hidden).toBe(false);
    expect($('app').hidden).toBe(true);

    $('token').value = 'ghp_test';
    $('login-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(titles()).toHaveLength(3));

    expect(localStorage.getItem('gitbug.token')).toBe('ghp_test');
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/user');
    expect(titles()[0]).toBe('tlembedded/gitbugprivate'); // newest first, with badge
    expect($('status').textContent).toMatch(/^3 repos · updated/);
  });

  it('renders cached repos immediately and refreshes in the background', async () => {
    localStorage.setItem('gitbug.token', 't');
    localStorage.setItem('gitbug.repos.v1', JSON.stringify({
      at: 1, repos: [{ id: 9, n: 'old/cached', d: '', u: 'https://github.com/old/cached', t: 0 }],
    }));
    mockGitHub(REPOS);
    await boot();
    expect(titles()).toEqual(['old/cached']);
    await vi.waitFor(() => expect(titles()).toHaveLength(3));
  });

  it('fuzzy filters, highlights, and navigates with the keyboard', async () => {
    localStorage.setItem('gitbug.token', 't');
    mockGitHub(REPOS);
    await boot();
    await vi.waitFor(() => expect(titles()).toHaveLength(3));

    type('fwb');
    expect(titles()).toEqual(['tlembedded/fw-bootloaderarchived']);
    expect([...document.querySelectorAll('#list mark')].map((m) => m.textContent).join('')).toBe('fwb');

    type('');
    expect(document.querySelector('#list a.sel').href).toBe('https://github.com/tlembedded/gitbug');
    key('ArrowDown');
    expect(document.querySelector('#list a.sel').href).toBe('https://github.com/acme/core-utils');
    key('ArrowUp');
    key('ArrowUp'); // wraps
    expect(document.querySelector('#list a.sel').href).toBe('https://github.com/tlembedded/fw-bootloader');

    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    key('Enter', { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://github.com/tlembedded/fw-bootloader', '_blank', 'noopener');

    type('zzzz');
    expect(document.querySelector('#list .empty').textContent).toBe('No matches.');
    key('Escape');
    expect($('q').value).toBe('');
    expect(titles()).toHaveLength(3);
  });

  it('drops a revoked token and returns to login', async () => {
    localStorage.setItem('gitbug.token', 'revoked');
    mockGitHub([], { status: 401 });
    await boot();
    await vi.waitFor(() => expect($('login').hidden).toBe(false));
    expect(localStorage.getItem('gitbug.token')).toBeNull();
    expect($('login-error').textContent).toMatch(/Token rejected/);
  });
});
