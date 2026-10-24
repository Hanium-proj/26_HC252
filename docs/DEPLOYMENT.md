# Research deployment

- Frontend: https://26-hc-252.vercel.app, Vercel project `26-hc-252`.
- Backend: Railway `hanium-chest-ai` / `chest-api`, `main`, root `/backend`.
- Volume: `/data` (5 GB); runtime data `/data/live`, models `/data/model-cache`.
- Single replica; CPU inference; 4 GB RAM / 2 vCPU limits. Shared research workspace, not multi-tenant clinical software.

## Access and secrets

On 2026-10-25 KST, the owner explicitly requested public sharing without protection. Vercel Authentication was disabled (`ssoProtection=null`). The production URL now allows anonymous access to the shared workspace, including studies and analysis. The backend API key remains server-only. `PRIVATE_VERCEL_WORKSPACE=true` is a legacy hosted-proxy configuration flag, not evidence that requests are authenticated. Do not assume per-user isolation or a Vercel login requirement. To return to private operation, enable authentication for all deployments (`ssoProtection.deploymentType=all`).

Railway uses `ENVIRONMENT=production`, `API_KEY`, and `OPENAI_API_KEY`. Vercel holds `BACKEND_URL` and sensitive server-only `BACKEND_API_KEY`. Never use a NEXT_PUBLIC variable for credentials. Production upload limit is 4 MB (`NEXT_PUBLIC_MAX_UPLOAD_MB=4`) to fit Vercel multipart requests; local limit is 15 MB.

## Private corpus import

A temporary `DEPLOYMENT_IMPORT_TOKEN` enables backend `PUT /internal/bootstrap/{filename}` with `X-Import-Token` and `X-Content-Sha256`. Only `knowledge-vectors.npz` and `case-reports.sqlite3` are accepted, up to 300 MB each. Files are streamed, checksum-verified, and atomically published without overwriting existing indices. The frontend cannot proxy this endpoint. Set the token empty and redeploy after transfer; verify 404 afterwards.

Raw MIMIC archives are not required at runtime. Keep indices, images, environment files, and migration credentials out of Git and container images. Back up the private volume before destructive operations.

## Verification

Run backend tests/lint and frontend lint/build before release. For public sharing, verify anonymous frontend and proxied API requests work; direct backend study requests must still return 401 without a key. Verify uploads/analysis and actual search sources. Deployment and throughput checks do not establish diagnostic accuracy.

## Verification record · 2026-10-25 KST

- Backend unit/API suite: 85 passed; ruff passed. Frontend lint and production build passed.
- Public unauthenticated frontend API: 302 to Vercel authentication. Backend `/studies`: 401 without API key. Disabled import: 404.
- Both private indices transferred with SHA-256 verification; survived backend redeployment. The production workspace starts independently of local patient worklists.
- Uploaded repository example `0142/original.png` through the production frontend proxy. Browser analysis completed in 20.896 s, including 18 classifier outputs and actual CAMs; classifier inference 2.045 s. Completion state, automatic result focus, and evidence navigation verified in the browser.
- Direct production backend corpus searches, top 3: knowledge 2.68 s, case reports 3.30 s, public literature 3.75 s. Each returned 3 actual hits. These are individual smoke-test observations, not throughput or accuracy benchmarks.
- Production frontend proxy SSE: plan, tool, evidence, verdict, 394 token events, done; no error event.
- Runtime verification artifacts are private under ignored `backend/data/deploy-verification/`.

## Public sharing update · 2026-10-25 KST

Owner requested removal of protection for sharing. This supersedes the authentication expectations in the earlier private-deployment verification record. No API keys were published and backend authentication remains enabled.
