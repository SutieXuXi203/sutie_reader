# Security & Performance Audit — Sutie Reader (Round 2)

Date: 2026-11-11 · Commit audited: `802fc3b` (main) · Scope: whole repo (Next.js 16.4.4 / React 19 / MongoDB+Mongoose 9 / Redis / Cloudflare Worker + Google Drive).
**No source file was modified.** This report is the only file added. Nothing was run against production: all dynamic tests used a throw-away local MongoDB (port 27099) and Redis (port 6399), both stopped and deleted afterwards, with Drive/Worker mocked.

This is a follow-up to `AUDIT_REPORT.md` (2026-11-03). I re-verified its fixes and audited everything added since (Redis layer, token blacklist, scrambled-image cache, 500-image upload path).

**Evidence labels**
- **[DYNAMIC]** reproduced by running the real code (route handlers / Worker) in the isolated environment above.
- **[MEASURED]** a number I measured, on the machine/data stated.
- **[CODE]** established by reading the code path; not executed.
- **[POTENTIAL]** depends on configuration/exploitability I could not demonstrate.

---

## 1. Executive summary

| Item | Result |
|---|---|
| `npm test` | **169/169 pass** (docs say 148 — outdated) |
| `npm run test:integration` (real route handlers, isolated temp MongoDB) | **17/17 pass** |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` (dummy env) | succeeds, exit 0 |
| `npm run lint` | 20 problems: **1 error** (`react-hooks/refs`, `CreatePostForm.tsx:67`), 19 warnings |
| `npm audit --omit=dev` | 8 vulns: **2 high** (`mongoose`, `source-map-js`), 6 moderate |
| `npm audit` (all) | 27: 1 critical, 7 high, 18 moderate, 1 low (dev tooling mostly) |
| Secrets in git | none found; `.env` is git-ignored and never appeared in history. Local `.env` strength checked by length/format only (JWT secret 64 chars, PIN not the example value, Redis uses TLS + password) |
| Load test (P95/P99/throughput) | **Not performed** (see §10) |

**Overall:** the fixes from the previous audit still hold (re-verified by the test suites and reading; see §3). The new work introduced **one High** — the Worker `/avatar/` endpoint serves comic page originals without a signature, which defeats the signed-URL / scramble design — and several **session-revocation gaps** (the UI logout never revokes the token). Performance risk is concentrated in the image path (unindexed regex fallback, lossless-WebP payload size, whole-story payloads), none of it load-tested yet.

Findings: **1 High · 6 Medium · 12 Low · several Info**. No Critical.

---

## 2. System architecture (as audited)

- **App**: Next.js App Router, `src/proxy.ts` (PIN gate + `/admin`), 27 route handlers under `src/app/api/**`, 3 Server Action files (`src/actions`). ~30k lines TS/TSX.
- **Data**: MongoDB via Mongoose (`comics`, `users`, `bookmarks`, `api_rate_limits`, `deleted_users`, `genres`, `roles`). No SQL. Pool `maxPoolSize: 10` per instance (`lib/db.ts:51`).
- **Redis (new)**: shared cache (`api-cache`), atomic rate limiting (Lua), user-session cache, token blacklist, access-tracking debounce. Graceful fallback to RAM/Mongo when absent.
- **Auth**: HS256 JWT in httpOnly cookie `token` (24h/7d), role re-read from DB (L1 RAM 15s → Redis 60s → Mongo). `site_access_token` (30d, scope `site_unlock`). Admin upload token (10 min, scope `upload`) signed with the same `JWT_SECRET`.
- **Images**: admin browser → Worker `/upload` (JWT `scope:upload`) → Google Drive. Readers: `/api/image/[id]` (auth, per-chapter authz for `guest`, signs a Worker URL server-to-server, scrambles 8×8 with sharp, caches result in RAM) → browser reassembles on canvas.
- **External**: Google Drive (OAuth refresh token), Gmail SMTP, Telegram Bot (audit log), dicebear (avatars).
- **CI**: `.github/workflows/ci.yml` (test, tsc, build, non-blocking audit).

### Checklist of inspected modules
Fully read: `proxy.ts`, `lib/{server-auth,rateLimit,memoryRateLimit,redis,tokenBlacklist,api-cache,clientIp,image-signing,imageAccess,scrambledImageCache,scramble-server,permissions,utils,imageUrls,validations,password,sitePin,trackAccess,telegramLogger(part),db}`, `models/{Post,User}`, `actions/*`, API routes: `auth/{login,register,verify,me,logout,refresh,token}`, `unlock`, `image/[id]`, `og-image`, `posts` (+`[id]`, `chapters`, `share`, `access`), `bookmarks` (+`[postId]` part), `tags`, `contact`, `telegram/{log,progress}`, `admin/{users,users/[id],shares}`, `roles`, `cloudflare-worker/index.js`, `lib/uploadService.ts`, `ReaderImage.tsx`, `posts/[id]/page.tsx`, `sitemap.ts`, `next.config.ts`, CI workflow.
**Pattern-scanned only (not read line-by-line):** large client components (`PostDetailClient`, `ShareDialog`, `EditPostForm`, `CreatePostForm`, `HomeClient`, admin tabs, `PostCard`), `telegram.ts`, `mail.ts`, `unverifiedUserCleanup.ts`, `scramble.ts`, `ScrambledCanvas.tsx`, `scripts/`. Scan covered `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `$where`, `$regex`, storage APIs, `NEXT_PUBLIC_*`: no XSS sink with user data was found (only one static inline script in `layout.tsx`).

---

## 3. Verification of previous findings
All items marked fixed in `AUDIT_REPORT.md` were re-checked via the unit suite, the 17 integration tests (parallel brute-force lockout, PIN race, OTP race, `pid` IDOR, `thumb=1`, access-cache keying, fail-closed 503, duplicate chapter numbers, Worker URL not leaked) and code reading. **No regression found.** Still-open known items (not re-reported as new): shared 6-digit PIN is a site gate not 2FA (SEC-15), scramble is obfuscation only (SEC-07), registration reveals email existence (LOW-04).

---

## 4. Security findings

### R2-SEC-01 — HIGH — Worker `/avatar/<id>` serves comic originals with no signature **[DYNAMIC]**
- **File:** `cloudflare-worker/index.js:629-675` (folder check at `:645`).
- **Explanation:** `/image/<id>` requires an HMAC-signed, expiring URL. `/avatar/<id>` requires nothing; it only checks "file is an image inside the allowed Drive root folder". Comic pages and avatars live under the same root, so any comic page id works.
- **Root cause:** SEC-09 fix added folder + mime checks to `/avatar`, but avatars are not distinguishable from pages (no dedicated folder/marker check at serve time).
- **Evidence:** PoC `poc-avatar.mjs` (mock Drive, real Worker code): `GET /image/<comic>` unsigned → **401**; `GET /avatar/<comic>` unsigned → **200, body byte-identical to the original**. The existing test `worker.test.ts:94` only covers files *outside* the root.
- **Attacker needs:** a registered account (any Gmail) and a Drive file id. Ids appear in `/api/image/<id>.webp` URLs of chapters the user may read, and the Worker URL is public (`NEXT_PUBLIC_CLOUDFLARE_WORKER_URL`). Locked chapters return `images: []`, so this does **not** expose content the user is not allowed to read; it removes the protections around content they *can* read.
- **Impact:** an authorised reader (or scraper with one throw-away account) pulls full-resolution unscrambled pages straight from the Worker/CDN: no scramble, no per-user rate limit (`IMAGE_RATE_LIMIT_MAX`), no `Telegram`/audit trail; responses are edge-cached for a year (`EDGE_IMAGE_CACHE_SECONDS`). This nullifies the product's core anti-leech guarantee in `docs/SECURITY_RULES.md §1–2`.
- **Fix:** serve `/avatar` only for files in the dedicated "Avatars" folder (store its id / tag files with `appProperties.sutieKind=avatar` at upload and check at serve time), or sign avatar URLs like images. Add a Worker test: comic file id via `/avatar` must not return 200.
- **Complexity:** Low (≈20 lines + test). Existing avatars: files already in the `Avatars` folder keep working.

### R2-SEC-02 — MEDIUM — Logout does not revoke the session; revoked tokens can mint new ones **[CODE + DYNAMIC]**
Three linked defects:
1. **UI logout skips revocation [CODE].** `AuthContext.tsx:91` calls the Server Action `logoutAction` (`actions/authActions.ts:57-74`), which only clears cookies. `revokeToken()` runs only in `POST /api/auth/logout` (`logout/route.ts:9`), which nothing in `src/` calls. So in the real UI the blacklist added in commit `303f11d` is never written. A copied cookie stays valid until `exp` (24h, or 7d with "remember me").
2. **Revoked tokens still work in two routes [DYNAMIC].** `auth/refresh/route.ts:19` and `PUT auth/me/route.ts:146` use bare `jwtVerify` and never consult the blacklist. PoC (`poc-routes.test.ts`, isolated Redis): after `POST /api/auth/logout`, `GET /api/auth/me` with the old token → `user: null` (blacklist works), but `GET /api/auth/refresh` → **307 + fresh 7-day admin token**, `PUT /api/auth/me` → **200 + fresh token**, and that new token → `/api/auth/me` returns `role: admin`.
3. **Revocation is Redis-only and fails open [CODE].** `tokenBlacklist.ts:26-30` returns "not revoked" when Redis is unconfigured or unreachable (see R2-RES-01). Also an L1 RAM hit (`server-auth.ts:146-150`) is served before the blacklist check (≤15 s window).
- **Likelihood:** needs a stolen/copied cookie (cookie is httpOnly, no XSS sink found) → Medium, not High.
- **Fix:** make `logoutAction` call `revokeToken` (or have the client call `/api/auth/logout`); route `refresh` and `PUT me` through `getCurrentUserFromToken`; add a per-user `tokenVersion`/`jti` stored in Mongo so revocation also survives Redis loss and password/role changes.
- **Complexity:** Low–Medium.

### R2-SEC-03 — MEDIUM — `/api/og-image` leaks page 1 of a *restricted* chapter 1 of a public story **[DYNAMIC]**
- **File:** `api/og-image/[postId]/route.ts:59-69`.
- **Explanation:** the cover is taken from `post.images[0]` (legacy mirror of chapter 1's images) *before* the "skip restricted chapters" filter that only applies to the fallback.
- **Evidence:** PoC: public post whose chapter 1 is `accessType: restricted` → **anonymous** `GET /api/og-image/<id>` → **200 image/webp** (600 px, unscrambled). Docs (§1) state this endpoint serves only unrestricted chapters.
- **Impact:** first page of a locked chapter readable by anyone, no login; response is also CDN-cacheable (`s-maxage=86400`).
- **Fix:** derive the cover from the first chapter that is not `restricted`; ignore `post.images` or validate it against the chapter list.
- **Complexity:** Low.

### R2-SEC-04 — MEDIUM — Guest-triggered unindexed `$regex` scans on `/api/image` (DB amplification) **[MEASURED + CODE]**
- **File:** `api/image/[id]/route.ts:73-89` (fallback), `:167-176`; covers without `pid`: `api/posts/route.ts:304-309`, `api/bookmarks/route.ts:124`.
- **Explanation:** for role `guest` (the default role of every registered Gmail), when `pid` is missing/wrong the route runs `Post.findOne({$or:[{images:{$regex:id}},{'chapters.images':{$regex:id}}]})` — no index can serve it, so it scans the collection. The access cache is keyed per `(user, imageId)`, so varying `id` (any `[A-Za-z0-9_-]{10,}`) bypasses it. Rate limit: 800 req/min per (user, IP).
- **Measured:** synthetic collection, 300 posts × 20 chapters × 40 images (240,000 image strings), local mongod 8.0, i5-12450H: `findById` **1.4 ms** vs regex scan **82 ms** (identical for hit and miss). 800 req/min × 82 ms ≈ 65 s of DB time per minute on one account; accounts are free. Scales linearly with catalogue size. Not load-tested end-to-end.
- **Normal-use impact too:** the home list and bookmarks return covers *without* `pid`, so every guest page view triggers one scan per card (then cached 60 s).
- **Fix:** always append `pid` (list/bookmarks), and add a lookup collection `image_refs{fileId unique, postId, chapterNumber}` maintained on post/chapter writes (or a multikey index on a normalized id array); reject unknown ids without scanning.
- **Complexity:** Medium.

### R2-DEP-01 — MEDIUM (advisory rating High) — Vulnerable dependencies **[POTENTIAL]**
- `mongoose 9.10.1` (range 9.0.0–9.11.3): GHSA-gg4r-jv3p-qx3c (connection `sanitizeFilter` not applied), GHSA-wr5m-5jph-8m96 (discriminator key poisoning), GHSA-8332-j7wj-wjw4 (inherited-property walk → DoS/overwrite), GHSA-6972-9mcm-vhwj (prototype pollution via `Schema.prototype.virtual`). `fix available` per `npm audit`.
- `source-map-js` (high, build-time event-loop DoS), plus moderate transitive: `qs`, `gaxios`/`google-auth-library`/`rimraf`/`glob`/`minimatch` (via `googleapis`).
- **Exploitability:** not demonstrated. I found no route that passes raw user objects into Mongoose filters, and schemas are static, so the practical risk looks lower than the advisory rating. Treat as "patch soon", not "incident".
- **Fix:** `npm audit fix` (mongoose ≥ 9.11.4), run `npm test` + integration tests; make the CI audit step blocking (`ci.yml:28-30` has `continue-on-error: true`).
- **Complexity:** Low.

### R2-SEC-05 — LOW — SSR post page and metadata don't enforce `canViewPost` **[CODE]**
`posts/[id]/page.tsx:174-283` and `generateMetadata` (`:16-71`) never call `canViewPost`. For a restricted post an anonymous visitor who knows the id gets title, description, tags, translator, chapter titles/count in the HTML and `<title>`/OG tags (content and images are correctly blanked per chapter). `GET /api/posts/[id]` does return 401/403, so the two entry points disagree.
**Fix:** call `canViewPost` first; return a generic metadata/lock screen for denied users. Complexity: Low.

### R2-SEC-06 — LOW — OTP verification has no IP limit; plaintext OTP **[CODE]**
`auth/verify/route.ts`: 5 attempts per account (atomic, good) but no per-IP limit; `register` resets `verificationAttempts` to 0 and issues a new code (5 registrations / 15 min / IP). Across many IPs an attacker can keep guessing a 6-digit code for a victim's pending signup (≈5 guesses per cycle of 1,000,000). Impractical but unbounded. Also the OTP is stored in plaintext (`select:false`). Also allows an attacker to burn a victim's attempts (DoS on their signup).
**Fix:** per-IP `consumeAttempt` on verify, global per-email daily cap, hash the OTP. Complexity: Low.

### R2-SEC-07 — LOW — Role `user` vs restricted chapters is inconsistent **[CODE]**
`permissions.ts:208-222` denies `user` a `restricted` chapter unless shared; `docs/SECURITY_RULES.md §3` says `user`/`admin` read everything; `/api/image/[id]:167` skips authorization for every non-guest. Net effect: lock UI says "locked" but image ids are served to `user` if known. Decide the intended rule and make the three places agree (add a test).

### R2-SEC-08 — LOW — Proxy gates use unverified claims **[CODE]**
`proxy.ts:39` trusts the JWT `role` claim for `/admin` for up to 7 days after demotion (APIs re-check the DB via `isAdmin`, so only the page shell is reachable); `proxy.ts:56-61` only checks that a `token` cookie exists for `/products`. Not exploitable for data; tighten for defence in depth.

### R2-SEC-09 — LOW — No Content-Security-Policy
`next.config.ts:58-67` sets X-Frame-Options, nosniff, Referrer-Policy, HSTS, Permissions-Policy but no CSP. No XSS sink was found, so this is hardening only (nonce-based CSP needs care with Next inline scripts).

### R2-SEC-10 — LOW — Weak password minimum
`validations.ts:39`: minimum 6 characters (max 72 is correct for bcrypt). Previously accepted; recommend ≥ 8–10 and a common-password check.

### Verified OK (no finding)
bcrypt via native module with dummy-hash timing equalisation; timing-safe compares; atomic brute-force counters (Redis Lua + Mongo pipeline fallback); trusted-proxy IP extraction; safe redirect; avatar data-URL validation; upload magic-byte checks in Worker; Worker upload only via shared secret or ≤15 min `scope:upload` JWT; no `$where`/unsafe regex input (`escapeRegExp` / pattern-restricted ids); admin routes all gated by DB-backed `isAdmin`; `accessedUsers`/`sharedWith` privacy filtering; CSRF limited by `SameSite=Lax` + JSON bodies (Server Actions use Next's origin check).

---

## 5. Performance findings

Environment for all numbers: Windows 11, Node 24.18, i5-12450H (12 threads), 15.7 GiB, local MongoDB 8.0 — **not production hardware**, synthetic data.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R2-SEC-04 | Medium | Regex image-owner scan (see §4) | 82 ms vs 1.4 ms **[MEASURED]** |
| R2-PERF-01 | Medium | **Scrambled output is lossless WebP** (`scramble-server.ts:67-75`). Synthetic 1200×1800 page: input 20 KB → **235 KB (11.7×)**; 2048×2048: 35 KB → 405 KB (11.6×). Real manga pages compress less well so the ratio will differ — **not measured on real pages**. If it holds near 5–10×, a 500-page chapter could mean hundreds of MB over mobile networks and strongly raises CDN/egress cost. CPU per page on synthetic data: 160 ms (1200×1800), 280–480 ms (2048²); 8 pages in parallel: 724 ms wall. | **[MEASURED, synthetic]** — please measure on 20 real pages before deciding |
| R2-PERF-02 | Medium | **Whole-story payloads.** `GET /api/posts/[id]` (`:393-412`) and the SSR page (`page.tsx:224-285`) send *every chapter's full image list* to the client; with 500 images × ~90-byte URL ≈ 45 KB per chapter, ≈ 4.5 MB per 100 chapters in the RSC/JSON payload (**estimate from URL length, not measured**). `bookmarks/route.ts:101` projects `chapters: 1` (all content/images) just to compute permissions. | [CODE] |
| R2-PERF-03 | Low | `clearUserCache` (`server-auth.ts:207-219`) deletes **all** `session:user:*` Redis keys with SCAN on every call, even for one user; `/api/auth/me` triggers it on role/name drift → thundering herd on Mongo. | [CODE] |
| R2-PERF-04 | Low | Tag rename/delete (`tags/route.ts:115-132, 177-183`) load full post documents (all chapters/images) and `save()` one by one; use `updateMany` with `$pull`/pipeline. | [CODE] |
| R2-PERF-05 | Low | `og-image` limit 30/min/IP (`og-image/.../route.ts:36`) while the anonymous list returns one og-image URL per card (`posts/route.ts:307`): a NAT'd visitor on a large catalogue can hit 429 (CDN `s-maxage` softens it). | [CODE] |
| — | Info | `bcrypt` native cost 12: 298 ms per hash; 10 parallel verifies 785 ms wall (thread pool, event loop stays free). Good. | [MEASURED] |
| — | Info | Mongoose `autoIndex: true` in production re-issues `createIndex` on every cold start (`db.ts:50`); `maxPoolSize: 10` × many serverless instances can exhaust small Atlas tiers. | [CODE] |

### Frontend
Virtual windowing (`ReaderImage.tsx`, IntersectionObserver ±2500 px) and batched uploads (`uploadService.ts`: 6 files/batch, 3 batches, 4 compressions, token refresh, retry/backoff) look sound. **Not measured:** bundle size, Core Web Vitals, re-render counts, memory leaks — no browser profiling was run (Turbopack build output prints no per-route sizes). 16 `react-hooks/set-state-in-effect` warnings indicate avoidable cascading renders.

### Backend/DB
Posts list uses a lean `$project/$map`; cache stack (RAM → Redis) with TTLs is reasonable. Indexes present: `Post` (`createdAt`, `tags`, `accessType`, `sharedWith.email`, `accessedUsers.email`), `Bookmark` unique `(userId, postId)`, `User.email` unique + TTL. **Missing:** an index/lookup for image-id → post (R2-SEC-04).

---

## 6. Resilience, operations & data protection

- **R2-RES-01 (Low)** `redis.ts:27-30`: `retryStrategy` returns `null` after 3 tries, so after a short outage the singleton stays in `end` state for the life of the process; every Redis call then fails (and logs) and the app silently degrades to per-instance RAM — rate limits and the token blacklist stop being shared/effective with no alert. Fix: keep retrying with capped backoff and alert via Telegram once.
- **R2-OPS-01 (Low)** CI: audit non-blocking; no lint step; integration tests not in CI; CI Node 22 vs local 24. Docs drift: `AGENTS.md`/`TESTING_MONITORING.md` say 148 tests (now 169); `SECURITY_RULES.md` says 360 img/min but code default is 800 (`image/[id]/route.ts:23`; `.env` overrides it).
- **R2-OPS-02 (Low)** Redis holds PII in plain JSON (`admin:users`, `admin:shares`, `posts:list` incl. `sharedWith` emails; short TTLs). Telegram receives emails, IPs and contact-form text. Redis here uses TLS + password (checked by format only); keep it that way and never expose it publicly.
- **R2-OPS-03 (Info)** Three stale git worktrees under `.claude/worktrees/` (detached old commits `67e46cc`, `c9f12c3`) contain old, pre-fix code; remove with `git worktree remove` to avoid scanners/IDE confusion.
- **Info:** `CLOUDFLARE_API_TOKEN` is in `.env`/README but unused by code — remove or scope minimally. Worker reads `UPLOAD_SECRET`, Next reads `CLOUDFLARE_UPLOAD_SECRET`: naming mismatch is a config trap. Worker CORS `*` is acceptable (all sensitive routes need a signature/bearer). `request.formData()` in the Worker buffers the whole body (128 MB isolate limit); current client batches (≈6 × <1 MB) are far below it.
- **Database security:** no SQL; no raw queries with user input; Mongo credentials present in URI (non-SRV); backups/permissions/DB role scoping **not assessable from the repo**.

---

## 7. Remediation roadmap (needs your approval before I change code)

**Phase A — quick wins, low risk (≈½–1 day, each with a regression test)**
1. R2-SEC-01 restrict Worker `/avatar` (+ redeploy Worker).
2. R2-SEC-02 `logoutAction` revokes token; `refresh` and `PUT /me` honour the blacklist.
3. R2-SEC-03 og-image cover from first unrestricted chapter.
4. R2-DEP-01 `npm audit fix` (mongoose) + make CI audit blocking, add lint + integration job.
5. R2-SEC-05 enforce `canViewPost` in SSR page/metadata; R2-SEC-06 per-IP limit on verify.

**Phase B — medium (≈2–3 days)**
6. R2-SEC-04 add `pid` everywhere + image-id lookup collection/index; drop the `$regex` fallback.
7. R2-PERF-01 measure real pages; decide on tile size/format (e.g. align tiles to 16 px with lossy WebP, or keep lossless with `effort`/size cap); R2-PERF-02 per-chapter fetch endpoint and slim bookmark projection.
8. R2-RES-01 Redis reconnect + alerting; R2-PERF-03/04 targeted cache invalidation, `updateMany` for tags.
9. `tokenVersion` in User for durable revocation.

**Phase C — long term:** nonce CSP, password policy, real 2FA for admin, decide the `user`-role rule (R2-SEC-07), load-test suite (k6) in staging, Playwright E2E, PII minimisation in Redis/Telegram.

**Preserved by design:** business logic, RBAC rules, scramble/obfuscation model, route shapes. Every change above is additive or tightens an existing check.

---

## 8. Verification results (before any fix)

| Check | Result |
|---|---|
| Unit/security tests | 169 pass / 0 fail |
| Integration (isolated temp MongoDB 8.0) | 17 pass / 0 fail |
| TypeScript | clean |
| Production build | success |
| Lint | 1 error, 19 warnings |
| PoC R2-SEC-01 (Worker + mock Drive) | reproduced |
| PoC R2-SEC-02 (routes + isolated Mongo + Redis) | reproduced |
| PoC R2-SEC-03 (route + isolated Mongo) | reproduced |
| Benchmarks | scramble, bcrypt, Mongo scan (synthetic, local) |

Before/after performance comparison is not yet possible (no fixes applied). Phase 7 regression (re-run tests, PoCs and benchmarks) will follow after approved fixes.

PoC scripts (scratchpad, outside the repo): `…\scratchpad\poc-avatar.mjs`, `poc-routes.test.ts`, `bench.mts`.

## 9. Limitations / not done
- **No load/stress/spike test, no P95/P99, no throughput**: needs a deployed or locally served instance plus a load tool (k6/autocannon); I did not start the HTTP server or generate load. The numbers above are micro-benchmarks only.
- Real Drive, Cloudflare edge cache, Vercel runtime, real Atlas cluster, backups, DB roles: not tested.
- No browser profiling (Core Web Vitals, bundle size, render counts) and no Playwright E2E.
- Large client components were scanned for sinks, not fully reviewed.
- Dependency exploitability not demonstrated.

## 10. Final assessment

| Dimension | Rating | Criteria |
|---|---|---|
| **Security** | **6.5 / 10 — Moderate** | +: all previous Critical/High fixed and covered by real-handler tests, strong auth primitives, atomic rate limits, no injection/XSS sinks found. −: one High that voids the anti-leech design (R2-SEC-01), logout/revocation gaps (R2-SEC-02), one data leak (R2-SEC-03), dependency advisories. Becomes ~8.5 after Phase A. |
| **Performance** | **6 / 10 — Unverified** | +: caching layers, batching, virtual windowing, native bcrypt. −: unindexed scan on a guest-reachable path, probable payload inflation from lossless scrambling, whole-story payloads, and **no load testing**. Score is capped until measured under load. |

**Awaiting your approval** — tell me which phase(s)/items to implement; I will not change code until then.

---

# Appendix — Phase A remediation status (2026-11-11)

All changes are uncommitted in the working tree. Each fix has a regression test that fails without the fix.

| ID | Status | Change | Test |
|---|---|---|---|
| R2-SEC-01 | Fixed | Worker `/avatar` serves only files tagged `sutieKind=avatar` or sitting directly in the root `Avatars` folder (no `postId`); new uploads are tagged; `isAvatar` ignored when a `postId`/chapter is present; `/avatar` edge cache moved to a new namespace so any comic page already cached under it is not served. | `src/worker.test.ts` (+4 tests); original PoC now returns 404 |
| R2-SEC-02 | Fixed (Redis-dependent, see note) | `logoutAction` revokes the token; `revokeToken` also clears the instance RAM cache; `/api/auth/refresh` and `PUT /api/auth/me` check the blacklist. | `tests/integration/session-revocation.test.ts` (needs Redis) |
| R2-SEC-03 | Fixed | `pickPublicCoverUrl` (new `src/lib/ogCover.ts`): cover only from an unrestricted chapter. | `src/lib/ogCover.test.ts` (6) + integration test |
| R2-SEC-05 | Fixed | `/posts/[id]` page and `generateMetadata` call `canViewPost`; denied users get a generic locked frame (no title/description/tags/chapters) and `noindex`. Login → `router.refresh()` still loads the real post. | Verified over HTTP on the built app (scratch DB): restricted page → 0 secret strings, public page unchanged; no automated test (server component) |
| R2-SEC-06 | Fixed (per-IP limit only) | `/api/auth/verify`: 20 attempts / 15 min / IP. OTP is still stored in plaintext (deferred). | integration test (40 parallel → exactly 20 processed) |
| R2-DEP-01 | Fixed | `npm audit fix`: mongoose 9.10.1 → 9.12.1 plus transitive updates; `package.json` unchanged. CI audit now blocking. | `npm audit --omit=dev`: **0** vulnerabilities (was 8); `npm audit` (all): 12 low/moderate dev-tool issues remain |
| R2-OPS-01 | Partly fixed | CI: blocking audit, lint, integration tests (Mongo + Redis services). Lint error `react-hooks/refs` in `CreatePostForm.tsx` fixed. Docs test counts updated. | CI not run (no GitHub runner here) |

**Notes / caveats**
- **Redeploy the Cloudflare Worker** for R2-SEC-01 to take effect in production.
- R2-SEC-02: revocation still needs Redis; without Redis only the cookie is cleared. A durable `tokenVersion` in Mongo is a Phase B item. Sessions started before this deploy cannot be revoked retroactively except by logging out again.
- Dependency update touched ~440 lockfile lines (npm 12 re-resolved the tree). `bcrypt` native binding and `tsx` were checked and still work; npm warned that install scripts for `bcrypt`/`esbuild`/`unrs-resolver` are blocked by policy — a fresh `npm ci` on CI/Vercel should be watched for `bcrypt` falling back to `bcryptjs` (still correct, but slower; see `src/lib/password.ts`).
- Unchanged and still open: everything in Phase B/C (R2-SEC-04, R2-PERF-01…05, R2-RES-01, R2-SEC-07…10, R2-OPS-02/03).

**Verification after fixes**

| Check | Before Phase A | After |
|---|---|---|
| `npm test` | 169/169 | **179/179** |
| `npm run test:integration` (isolated Mongo + Redis) | 17/17 | **21/21** (ran twice; also 18/18 with the Redis-only file skipped) |
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | 1 error, 19 warnings | **0 errors**, 19 warnings |
| `npm run build` | ok | ok |
| `npm audit --omit=dev` | 8 vulns (2 high) | **0** |
| PoC avatar (mock Drive) | 200, identical bytes | **404** |
| PoC revoked token → refresh / PUT me | new admin token issued | **no token issued** (401 / redirect `/`) |
| PoC og-image restricted chapter 1 | 200 image | **404** (all locked) / uses chapter-2 image (mixed) |

---

# Appendix — Phase B remediation status (2026-11-11)

Still uncommitted (stacked on Phase A). Each item has a test that fails without it unless noted.

| ID | Status | Change | Evidence |
|---|---|---|---|
| R2-SEC-04 | Fixed | New `Post.imageIds` (multikey index, `select:false`) maintained by `pre('save')`, `PUT /api/posts/[id]` (full reset) and `POST …/chapters` (`$addToSet`, only when the field already exists so a half-filled array can never be created). `/api/image/[id]` now looks up owner posts through the index (≤5 posts; allowed if **any** containing post allows) and keeps the `$regex` scan only as a fallback while `getImageIndexStatus() !== 'ready'`. `backfillImageIds()` fills legacy posts in the background on first use and re-checks every 10 min (also catches posts written by old instances during a rolling deploy). Home list and bookmarks now send `pid`; `ReaderImage` retries keep `pid`. | Synthetic 240k-string collection, same machine: regex scan **89 ms (hit) / 109 ms (miss)** → index **3.5 ms / 2.1 ms**; backfill probe 2.2 ms. Integration: `explain()` shows IXSCAN; no `$regex` query is issued for guest image checks once ready |
| R2-PERF-02 (partly) | Bookmarks fixed; payload part **deferred** | `GET /api/bookmarks` no longer loads every chapter's content/images (only the permission fields). The per-chapter lazy-load of `GET /api/posts/[id]` / SSR payload needs changes in the 1.5k-line `PostDetailClient` (chapter switching, resume, bookmarks) and browser verification I did not do. | integration test (cover has `pid`, response has no chapter text, pipeline uses `$map`) |
| R2-SEC-02 (hardening) | Fixed (done as a revocation list instead of `tokenVersion`) | `revokeToken` now also writes `revoked_tokens` in MongoDB (TTL index = token expiry + 1 h). `isTokenRevoked` uses Redis when it answers, MongoDB when Redis is absent/failing; `refresh` and `PUT /api/auth/me` always check both; the DB path of `getCurrentUserFromToken` checks it when Redis is configured. Logout therefore works **without Redis** and survives a Redis restart. I chose this over a `tokenVersion` on `User` because bumping a version would log the user out of every device on each logout; `tokenVersion` remains an option for "log out everywhere"/password change. | integration: logout → `/api/auth/me` null with no Redis, TTL index present |
| R2-RES-01 | Fixed | Redis client now retries forever (≤5 s backoff) instead of ending permanently after 3 tries; 2 s command timeout; one throttled Telegram alert per 10 min and a log line on recovery. | Simulated outage (`redis-outage.mts`): after 9 s down the client is `reconnecting` (old behaviour: `end`), and after restart `set/get` work again; a command during the outage returned in 656 ms via fallback |
| R2-PERF-03 | Fixed | `clearUserCache(userId)` uses a per-user index `session:uidx:<userId>` and deletes only that user's keys; no more SCAN of all `session:user:*` on every call (still used for the no-argument "clear all"). Sessions cached before this deploy have no index entry and expire on their own within 60 s. | integration (needs Redis): A's session removed, B's untouched |
| R2-PERF-04 | Fixed | Tag rename/delete are single `updateMany` calls (pipeline / `$pull`) instead of loading every full post and `save()`-ing one by one; `updatedAt` still bumps. | integration: rename (case-insensitive, no duplicates, unrelated posts untouched), delete, admin-only |
| R2-PERF-01 | **Not done** | Needs real manga pages to measure lossless-WebP inflation (the synthetic 11.7× is not representative). Nothing changed. | — |
| R2-SEC-06 (OTP hashing), R2-SEC-07…10, R2-OPS-02/03, R2-PERF-05 | Not done | Out of the requested Phase B list / low priority. | — |

**Deploy notes**
- First request after deploy starts `backfillImageIds` in the background; until it finishes, guests may take the slower `$regex` fallback (still correct). Existing posts get `imageIds` automatically, no manual migration needed. Mongoose creates the `imageIds` and `revoked_tokens` indexes at startup (`autoIndex` is on).
- `revoked_tokens` is a new collection (tiny; TTL-cleaned).
- Tokens revoked *before* this deploy exist only in Redis (if it was configured) and are not in MongoDB.

**Verification after Phase B**

| Check | Phase A | After Phase B |
|---|---|---|
| `npm test` | 179/179 | **181/181** |
| `npm run test:integration` (isolated Mongo + Redis) | 21/21 | **33/33** (and 11/11 for the new file without Redis, Redis-only test skipped) |
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings |
| `npm run build` | ok | ok |
| `npm audit --omit=dev` | 0 | 0 |

---

# Appendix — R2-PERF-02 lazy chapter loading (2026-11-11)

Still uncommitted (stacked on Phase A + B).

| Item | Status | Change | Evidence |
|---|---|---|---|
| R2-PERF-02 (post payload) | Fixed | New `GET /api/posts/[id]/chapters/[chapterNumber]` returns the image list of one chapter after `canViewPost` + `canViewChapter` (aggregate keeps only permission fields of other chapters; URLs are `/api/image/…?pid=`, never Worker URLs; `Cache-Control: private, no-store`). `GET /api/posts/[id]?lite=1` omits all chapter images (adds `imageCount`/`imagesLoaded`); without `lite` the response is unchanged (admin edit form). The SSR page sends images only for the chapter that opens first. `PostDetailClient` loads the active chapter on demand (spinner, error + retry), prefetches the next chapter once the current one is ready, uses `imageCount` for page totals and bookmark clamping, waits for images before resuming a saved page, and no longer re-fetches the bookmark each time a chapter finishes loading. | Integration (7 tests): 403/401 give no image data, per-chapter sharing respected, 400/404 cases, lite vs full. **Measured payload, synthetic 40 chapters × 100 images: full 275 KB → lite 8.2 KB; one chapter 6.6 KB** (≈ 69 bytes per image URL, so ≈ 35 KB per 500-image chapter) |

**Verified in a browser** (built app, scratch DB, stub image worker, user role, Browser pane visible): page opens with chapter 1 from SSR; saved bookmark (chapter 2, page 4) is restored after chapter 2 lazy-loads ("Chương 2/3 – Trang 4/6"); next chapter is prefetched so "Đọc tiếp Chương 3" shows 6 pages with no extra request and no spinner; a failing chapter shows "Không thể tải chương này … Thử lại". Not tested: very large chapters (500 images) in a real browser, mobile layout, slow networks, guest-with-shared-chapter flows in the UI (covered at API level only). A hidden Browser pane keeps the page from hydrating, so that check needed the pane in view.

| Check | After lazy-load |
|---|---|
| `npm test` | 181/181 |
| `npm run test:integration` (isolated Mongo + Redis) | **40/40** |
| `tsc` / build | clean / ok |
| Lint | 0 errors, **16** warnings (was 19) |
| `npm audit --omit=dev` | 0 |
