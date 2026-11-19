import { defineConfig } from 'vite';

// The token may only ever be sent to api.github.com. Applied to production builds
// only: the dev server needs inline styles (CSS HMR) and a websocket, which this blocks.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://avatars.githubusercontent.com",
  'connect-src https://api.github.com',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const cspPlugin = {
  name: 'gitbug-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig({
  plugins: [cspPlugin],
  build: { target: 'es2022' },
  test: { environment: 'jsdom' },
});
