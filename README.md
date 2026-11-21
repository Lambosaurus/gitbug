# gitbug

A static page that lists every GitHub repo you can access (your own, ones shared with you as a collaborator, and those in your orgs) with fuzzy search. It runs entirely in the browser with no backend.

## Auth

On first visit you paste a classic personal access token with the `repo` and `read:org`. The token is stored in local storage only, and sent to `api.github.com` to list repos.

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

## Deploy

```sh
npm run deploy
```

This is deployed to S3 and served via cloudfront

| Field | Value |
| ----- | ----- |
| Bucket | `gitbug-423142988617-ap-southeast-2-an` |
| Cloudfront distributioon | `E3AKA2T59GTNLH` |
| Cloudfront url | `dper547scb8r8.cloudfront.net` |
| End domain | `gitbug.tlembedded.com` |
