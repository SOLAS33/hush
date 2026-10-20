# Deployment and maintenance

Hush is static files. Cloudflare serves `dist/` as Worker static assets at https://hush.solas33.com.

## How it deploys

`.github/workflows/ci.yml` runs on every push to `main`:

1. `npm ci`, typecheck, unit and integration tests, production build.
2. The Chrome end-to-end test (real canvas JPEG encoder, real security headers).
3. On `main` only, and only when the secret holds a real token: `wrangler deploy` of `dist/` using `wrangler.jsonc`.

Needs the repo secret `CF_API_TOKEN` and the repo variable `CF_ACCOUNT_ID`. The custom domain `hush.solas33.com` is declared in `wrangler.jsonc` (`custom_domain: true`), so the first deploy creates the DNS record and certificate.

## Deploy by hand

```
npm ci && npm run build
npx wrangler deploy        # logged in with wrangler login, or CLOUDFLARE_API_TOKEN set
```

## Hosting rules

* HTTPS only. Cloudflare provides the certificate.
* `dist/_headers` carries the Content Security Policy and other headers. If a new file type or origin is needed, change `public/_headers` and run the end-to-end test: it fails on a CSP violation.
* `sw.js` and the manifest are sent with `no-cache` so updates arrive. Built files under `/assets/` are immutable (the file name changes with the content).
* The service worker's cache name changes with every build, and the old cache is removed when the new worker activates.

## Updating

Change code, run `npm test && npm run build && npm run test:e2e`, push to `main`. Open installed apps pick up the new version the next time they are opened online.

## Rolling back

Re-run the deploy workflow on an earlier commit, or `git revert` and push.

## Dependencies

Versions are pinned in `package.json` with a lockfile. Only React and React DOM ship in the app. Everything else is a build or test tool. Licences are in [third-party.md](third-party.md). Review with `npm audit --omit=dev` and `npm outdated` each quarter.

## Retention

The host keeps no user data: there is none to keep. Cloudflare's own request logs are covered by Cloudflare's terms.
