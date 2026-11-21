# gitbug

A static page that lists every GitHub repo you can access (your own, ones shared with you as a collaborator, and those in your orgs) with fuzzy search. It runs entirely in the browser with no backend.

## Usage

- Type to fuzzy-filter. Multiple words are ANDed (`fw boot`).
- `↑`/`↓` (or `Ctrl-N`/`Ctrl-P`) to move, `Enter` to open, `Ctrl/Cmd-Enter` for a new tab, `Esc` to clear, `/` to focus search.
- With an empty query, repos are sorted by most recent push.

## Auth

On first visit you paste a **classic personal access token** with the `repo` and `read:org` scopes (the sign-in page links to GitHub's token form with these prefilled). Choose **No expiration** and you'll only need to do this once per browser.

- The token is stored in `localStorage` and only sent to `api.github.com`. The page's CSP (`connect-src https://api.github.com`, `script-src 'self'`) enforces this, and the page loads no third-party scripts.
- **SAML SSO orgs:** after creating the token, click *Configure SSO* next to it on GitHub and authorize each org. Otherwise those orgs' repos are silently left out.
- **Why classic and not fine-grained:** a fine-grained token is scoped to a single owner (you *or* one org), so it can't list everything at once.
- **Why not OAuth:** GitHub's OAuth token exchange needs a client secret and doesn't allow CORS, so it would need a backend such as a Lambda. That can be added later if wanted.
- The repo list is cached in `localStorage`, so it shows instantly and then refreshes in the background.
- *Sign out* deletes the token and cache from the browser. To fully revoke the token, delete it on GitHub.

## Development

```sh
npm install
npm run dev        # http://localhost:5173, live reload
npm test           # vitest: search ranking, GitHub client, and a jsdom UI test with the API mocked
npm run build      # outputs dist/
npm run preview    # serve dist/ at http://localhost:4173. Same CSP as production.
```

The Content-Security-Policy is injected only into production builds (see `vite.config.js`), because the dev server needs inline styles and a websocket. Use `npm run preview` to check the locked-down version.

Requires Node 18+ (Vite 6). Vite 7 would need Node 20.19+ or 22.12+.

## Deploy (S3 + CloudFront)

```sh
npm run deploy
```

This targets bucket `gitbug-423142988617-ap-southeast-2-an` and CloudFront distribution `E3AKA2T59GTNLH` (`dper547scb8r8.cloudfront.net`). To deploy elsewhere, override them with `BUCKET=… DIST_ID=… npm run deploy`.

This runs the tests, builds, uploads the hashed `assets/` with a one-year immutable cache, uploads `index.html` with `no-cache`, uploads `favicon.ico`, and invalidates `/`, `/index.html`, and `/favicon.ico`. Stale assets from old builds are left in the bucket, which is harmless.

CloudFront setup:
- Origin: the S3 bucket with Origin Access Control. Default root object: `index.html`.
- Alternate domain `gitbug.tlembedded.com` with an ACM cert in **us-east-1**, plus a Route 53 alias or CNAME.
- Viewer protocol policy: Redirect HTTP to HTTPS.
- Recommended: attach a response headers policy with `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`, which can't be set from a `<meta>` tag), `X-Content-Type-Options: nosniff`, and HSTS.
