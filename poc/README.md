# PoC — Mode A, four assertions, one command

**Requirements & no-gos:** [`docs/01-product/prd.md`](../docs/01-product/prd.md) §4–§5.
**Status:** REBUILDING on the module ladder M1–M6 — a first build was
**rolled back 2026-08-15** (it went monolith-then-integrate without
per-module user validation; see PRD §4.4 and the decision log). Each module
is POC'd against its toughest assumption, built, proven end-to-end on its
own, and **validated by the user before the next module starts**. Built so
far, each runnable on its own (negatives first, exit 0 only if every case
holds):

```
node poc/m1-check.mjs   # M1 attestation core — 19 cases (user-validated 19/19)
node poc/m2-check.mjs   # M2 blind envelope — 10 cases (user-validated 10/10)
node poc/m3-check.mjs   # M3 floor gate — 22 cases (user-validated 22/22)
```

M4–M6 are not started; `poc/demo.mjs` does not exist yet. The measured
Playground findings below are kept — they are dated evidence and still bind
the M5 design.

Target UX once M6 lands (unchanged by the rollback):

```
node poc/demo.mjs                    # mock backend: zero credentials, zero network

# live: Orange Network APIs Playground. `| head -1` because a `pass` entry is
# multi-line (secret on line 1, notes below) — the adapter also defends itself
# by using line 1 only, but a whole entry in a header makes fetch throw a string
# quoting the notes.
ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/demo.mjs --backend orange
```

Exit code 0 only if all four assertions — including their negatives — hold;
1 if any fails; 2 if the backend cannot start at all (e.g. `--backend orange`
with no `ORANGE_BASIC_AUTH` — it prints the prereqs and exits 2).
Node ≥ 20, zero dependencies, real crypto (`node:crypto`: Ed25519 signatures,
RSA-4096 OAEP-SHA256 envelopes for the end-to-end leg past the hub — one
vetted primitive, per the PRD decision log).

## What it proves (four assertions, each shown failing too)

1. **Windowing** — the wire carries `swapAge ≥ 90d → true|false`, never the
   swap timestamp. Negative: flip the backstory ("swapped yesterday" ↔
   "swapped 120d ago") — the boolean flips, the payload shape doesn't.
2. **Nonce + expiry** — replaying a captured response is rejected; expired
   responses are rejected.
3. **Blind hub** — the hub's own log printed on screen: metering records only
   (count, route, "bill"). Negative: the hub attempting to read gets
   ciphertext — the encryption is real, not a comment.
4. **Monotone floor** — a request below the operator's published floor is
   rejected, never silently answered wider; tightening is accepted.

## Architecture

```
[RP demo "bank"] ──(predicate + floor + nonce, encrypted)──▶ [blind hub] ──▶ [operator shim]
                                                              meters & "bills"    ┌───────────────┐
                                                              ciphertext only     │ facts adapter │
[RP demo] ◀──(signed {predicate, result, nonce, exp}, encrypted)─────────────────┤ mock │ orange │
                                                                                  └───────────────┘
```

One operator-facts adapter, two backends behind it:

- **mock** (default): local stub with per-number scriptable backstories
  mirroring the Playground admin model (swap date, roaming country,
  reachability). Deterministic; runs on a clean clone.
- **orange**: the Playground's sim-swap API; backstories set via its Admin API.
  Credential from the environment only (`ORANGE_BASIC_AUTH`, the Playground
  Basic Auth string) — never the tree, never logged: the credential, the
  client id Orange echoes back inside 403 bodies, and every bearer token are
  redacted out of anything the adapter can print or throw. Demo code and
  printed evidence are identical either way.

Stated caveat (carried in the demo output): the operator shim simulates
operator-side predicate computation and signing; consent/legal-basis legs are
out of scope. And per claims discipline, the output never uses ZK language.

## Build order (PRD §4.4 — module ladder, user-validated per module)

M1 attestation core → M2 blind envelope → M3 floor gate → M4 mock facts
adapter → M5 orange facts adapter → M6 one-command integration. Each module:
POC aimed at its toughest assumption → build → runs end-to-end alone → USER
validates → next. The Playground spike (raw endpoint capture) already ran;
its findings below stand as evidence and shape M5.

## What the Playground actually does (measured, not doc-sourced)

Grounded by a throwaway Orange spike plus the adapter's own live runs
(2026-08-15) — both rolled back out of the tree with the G0 rollback; the
findings stand here as dated evidence.
Everything below is captured behaviour; where it contradicts the docs, this wins.

- **Token** — `POST https://api.orange.com/openidconnect/playground/v1.0/token`
  with `Authorization: Basic <cred>`, `Content-Type:
  application/x-www-form-urlencoded`, body `grant_type=client_credentials` →
  `{access_token, expires_in: 3600}`. Cached and refreshed a minute early.
- **Two token endpoints, NOT interchangeable.** The Admin API rejects the
  CAMARA playground token with `401 UNAUTHENTICATED`; it wants a token from
  `https://api.orange.com/oauth/v3/token` (same Basic credential, same grant).
  The adapter therefore holds one token per surface. Only a `401` means
  expiry — on it, re-exchange once and retry once, then fail.
- **Sim-swap** — `POST .../camara/playground/api/sim-swap/v1/retrieve-date`
  with `{"phoneNumber":"+990…"}` → `{"latestSimChange":"<ISO-8601, ms>"}`.
  That single call satisfies the whole facts interface.
- **`403 {"code":"FORBIDDEN"}` on sim-swap means UNKNOWN NUMBER**, not an auth
  failure — the adapter says so in as many words, because reading it as an
  auth problem sends you debugging the wrong thing.
- **`/check`'s `maxAge` is in HOURS, capped at 2400** (≈100 days) — measured,
  not clearly documented. A 90-day floor is `maxAge: 2160`. The adapter does
  not use `/check` (a floor above ~100 days would be uncomputable there);
  it takes the date and windows it locally.
- **Backstories** — `POST .../camara/playground/admin/v1.0/action` with
  `LIST | CREATE | READ | UPDATE | DELETE`. `UPDATE {"data":{"simSwap":
  {"latestSimChange":"<ISO>"}}}` sets the swap date. `DELETE` answers `204`
  with an empty `text/html` body — read it as text, never `res.json()`.
- **THE TRAP: built-in numbers silently ignore writes.** The built-in cast
  (`+990100000000`–`…05`) answers `CREATE`/`UPDATE` with `200`/`201` echoing
  your payload back, while the stored dataset never changes — sim-swap keeps
  returning the built-in date (and a `LIST`ed custom entry for such a number
  is shadowed by the built-in). **The echo is never proof.** So the adapter
  does a `READ` after every `UPDATE` and asserts the stored
  `simSwap.latestSimChange` equals what it wrote, failing loudly otherwise.
  The demo therefore scripts a **custom slot** (`+990100000099`), created on
  first use and left in place so re-runs are idempotent (quota: 10 per app).

## Getting Playground credentials (grounded 2026-08)

1. Create account at developer.orange.com (email, name, country, job) → verify email
2. My Apps → create app (name, description)
3. In the app: Add an API → search "Network APIs Playground" → Next
4. Credentials tab → Show → copy the Basic Auth string
   (free, instant, no approval process)

Built-in test numbers: +990 country code (e.g. +99012345678), 15 available
instantly; up to 10 custom numbers with scriptable backstories via the
Playground Admin API. Orange lab tier (real lab implementation, e.g.
device-roaming-status v0.6, lab numbers +40789103050–59) is demo material,
not a dependency — it may change without notice.
