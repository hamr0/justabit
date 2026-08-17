# PoC — Mode A, four assertions, one command

**Requirements & no-gos:** [`docs/01-product/prd.md`](../docs/01-product/prd.md) §4–§5.
**Status:** all six modules M1–M6 are BUILT — a first build was
**rolled back 2026-08-15** (it went monolith-then-integrate without
per-module user validation; see PRD §4.4 and the decision log) and the ladder
since then has held: each module is POC'd against its toughest assumption,
built, proven end-to-end on its own, and **validated by the user before the
next module starts**. M1–M5 were user-validated at the trees noted below;
**M6 is AGENT-RUN only, and every module the 3 -> 6 predicate round and the
2026-08-17 live-run fixes touched is AGENT-RUN again with a user re-run
PENDING** — so gate G1 (M1–M4 + M6 all user-validated) is NOT met, and neither
is G2. Every check runs on its own (negatives first, exit 0 only if
every case holds):

```
node poc/m1-check.mjs   # M1 attestation core — 20 cases (user-validated 19/19 at the
                        #   19-case tree; case 20 added by the M6 round —
                        #   AGENT-RUN 20/20, user re-run PENDING)
node poc/m2-check.mjs   # M2 blind envelope — 10 cases (module user-validated 10/10)
node poc/m3-check.mjs   # M3 floor gate — 25 cases (user-validated 22/22 at the
                        #   22-case tree; cases 23-25 added by the M6 and
                        #   3 -> 6 predicate rounds — AGENT-RUN 25/25,
                        #   user re-run PENDING)
node poc/m4-check.mjs   # M4 mock facts adapter — 40 cases (user-validated 33/33 at the
                        #   33-case tree; cases 34-40 added by the 3 -> 6 predicate
                        #   round — AGENT-RUN 40/40, user re-run PENDING)
node poc/m5-check.mjs   # M5 orange facts adapter, OFFLINE — 58 cases (user-validated
                        #   48/48 at 8e842c3, the shipped v0.3.0 state; cases 49-56
                        #   added by the 3 -> 6 predicate round, case 57 by the
                        #   live location-write fix, and case 58 by the
                        #   available/radius convergence probe — AGENT-RUN 58/58,
                        #   user re-run PENDING).
                        #   Zero credentials, zero network:
                        #   an injected transport replays responses captured live on
                        #   2026-08-16, so it runs on a clean clone.

# M5 LIVE — the G2 gate. Talks to the real Orange Playground.
# `| head -1` because a `pass` entry is multi-line (secret on line 1, notes below).
# The stored value is ALREADY `Basic <base64>`; the adapter normalizes either form.
ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/m5-check-live.mjs
                        # 19 cases (11/11 user-validated at 8e842c3, the shipped
                        # v0.3.0 state — that met G2 AT THAT TREE. The 3 -> 6 round
                        # never touched this file: the user's live run of it died on
                        # M5's own closed-field validation, so it was rewritten
                        # (11 -> 19, all six predicates on the live path, plus an
                        # OFFLINE case 1 pinning the story against the adapter's
                        # closed field set). AGENT-RUN 19/19 through an
                        # injected-transport REPLAY only — never against Orange.
                        # G2 is PENDING the user's re-run.)
                        # exit 2 + printed prerequisites if the credential is absent —
                        # never a silent pass, never a mock fallback.
                        # COSTS QUOTA: consumes and returns one of the app's 10 custom
                        # slots. It reclaims the slot BEFORE consuming it (so an
                        # interrupted run does not leak one), prints the count at both
                        # ends, and case 19 asserts it came back.

node poc/m6-check.mjs   # M6 integration — 45 cases (AGENT-RUN 45/45, user run
                        #   PENDING). Zero credentials, zero network in BOTH
                        #   backend modes: the `--backend orange` seam runs
                        #   through an injected transport replaying captured
                        #   Playground bytes, exactly like m5-check. It also runs
                        #   the demo itself and asserts its exit code, its 33/33
                        #   tally, and claims discipline (every mention of
                        #   zero-knowledge in the output must be a negation).
                        #   Takes ~15s — RSA-4096 keygen dominates.
```

## The demo — `node poc/demo.mjs`

```
node poc/demo.mjs                    # mock backend: zero credentials, zero network

# live: Orange Network APIs Playground. `| head -1` because a `pass` entry is
# multi-line (secret on line 1, notes below) — the adapter also defends itself
# by using line 1 only, but a whole entry in a header makes fetch throw a string
# quoting the notes.
ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/demo.mjs --backend orange
```

It prints the four assertions in plain language — a `Q:` with the scripted
backstory, the `A:` bit, then the negative flip — then the WIRED PREDICATE SET
(one section, one question per predicate, each with its negative), plus the
request-path guards (off-menu threshold, duplicate keys, response key pinning),
each with a control that disables that one guard and shows the SAME input being
accepted. **Exit 0
only if all 33 hold; 1 if any fails; 2 if the backend cannot RUN** (e.g.
`--backend orange` with no `ORANGE_BASIC_AUTH` — it prints the prerequisites and
exits 2, and there is deliberately no silent fallback to the mock).

Exit 2 means the backend could not run, and it is reserved for when that is
actually true. Under `--backend mock` there are no prerequisites at all, so a
mid-run crash there is a **code regression and exits 1, never 2** — a gate that
skips on 2 must not be able to swallow a regression. Under `--backend orange`
the same mid-run throw stays 2, because an unreachable live operator genuinely
is a prerequisite failure. (Fixed 2026-08-17; it used to be 2 either way.)

**Honest limit — the RP nonce store only grows.** A nonce is deleted when its
response is verified, so a request that never receives one (rejected by the hub,
dropped in transit, answered after the requester gave up) leaves its entry
resident forever. Harmless across a handful of demo requests, unbounded in
anything real; a deployment evicts on expiry, since the answer's validity window
is already the natural TTL. Stated rather than built — exercising a TTL would
mean faking elapsed time, and a stated limit beats an untested one.

The mock run is **AGENT-RUN 33/33 exit 0; the user run is PENDING.** The live
`--backend orange` run has not happened at all — it is the user's, and it is the
only thing that makes the FR5 claim a live one rather than a replayed one.
`poc/m6-check.mjs` proves the seam offline; it cannot prove the Playground still
answers today.

The **M6 round (2026-08-17)** then changed two of those modules, so two counts
moved: M1 gained case 20 (its duplicate-key scanner is now EXPORTED, so a signed
REQUEST can be checked for the same equivocation) and M3 gained case 23 (its
declared fix point — the rejection-message builder threw a bare `TypeError`
instead of producing the loud named-input rejection). Both are **AGENT-RUN by
exit code and PENDING a user re-run**; the user records below stand for the trees
they were run on and are not transferred forward.

All four were run by the user on their own machine after the v0.2.0 release
(main at `7c41c83`, tag `v0.2.0` — dated findings record, 2026-08-16): 19/19,
10/10, 22/22, 33/33. **M5 was then user-validated too — 47/47 offline and
11/11 LIVE at `69b6f2e`, which MET gate G2** (the first G2 validation in the
project; dated findings entry). The v0.3.0 release gate found two more code
defects after that run, taking the offline suite to **48** and fixing the live
quota case — the same post-validation pattern M4 hit at v0.2.0 — so **the user
re-ran the fixed tree at `4ac60e9` and reported 48/48 offline + 11/11 live**,
re-establishing G2 at that state. A post-gate code review round (2026-08-17)
then fixed three more adapter defects and three live-check faults (counts
unchanged), so **the user re-ran once more at `8e842c3` — the shipped v0.3.0
state — and reported both clean. Nothing is pending.** Each
check declares its case count (`conclude(20|10|25|40|58|19|45)`) so a suite that
silently loses cases exits 1 with
`FAIL CASE COUNT` instead of printing a smaller green tally — mutation-proven
per module.

The v0.2.0 release gate had found three more fail-opens, all wire-reachable
unbounded work: a time-of-check/time-of-use `length` re-read that walked
5,000,000 indices to a SIGNED answer past the 300-country cap, a diagnostic
renderer whose `toJSON` hook could kill the process outright (exit 134, fatal
OOM — a try/catch bounds a throw, not an allocation), and an input bound that
only ever covered top-level values. Fixing them changed **two** files —
`poc/m4-facts-mock.mjs` and `poc/m4-check.mjs` — and took M4 from 30 to **33**
cases; the three added cases pin exactly those guards, and the user run above
covers them. Nothing is pending.

**M5 was user-validated LIVE at `8e842c3`, the shipped v0.3.0 state — that IS
gate G2, and it WAS met at that tree. It is NOT met at this one.** The 3 → 6
predicate round changed the module, and the user's live run of that round found
the Admin `location` write shape was wrong (`400 "data.location.lastLocationTime
is required"`); the fix landed after the run, so **G2 is PENDING a re-run** and
`8e842c3`'s record is not transferred forward. That run also exposed a
**grounding failure**: `m5-check-live.mjs` was the ONE file the 3 → 6 round never
updated (`git log 8238d02..81f8da4` on it is empty), so all eight of its
`setBackstory` calls still passed the old three-field story and the gate died on
M5's own validation before proving anything — the write-trap case caught an
`invalid backstory` throw while asserting it had caught the built-in shadowing.
It is the only check here that cannot run offline, which is exactly why it was
the one that drifted unobserved. Rewritten **11 → 19 cases**: an OFFLINE case 1
pins its story against the adapter's closed field set (so a future field addition
reds on a clean clone with no credentials), the trap case now asserts it failed
for its OWN reason, and all six predicates are exercised on the live path with
their negatives. An adversarial review round on 2026-08-16 took
the offline suite
44 → **47** and the live suite 10 → **11**, closing one real module defect (the
write-verification diagnostic — the message the module's most load-bearing guard
produces — was the single throw path that skipped `redact()`, and it also
clamped after serializing rather than before), one unpinned invariant (one token
per surface, which a required mutant survived), and one quota-hygiene gap (the
live check's cleanup was unobserved, so an interrupted run leaked a slot
silently).

The **v0.3.0 release gate** then found five more issues, two of them real code
defects — which is why the user re-ran the fixed tree before the release
shipped. (1) The
stored `countryName` list was joined with `Array.prototype.join`, which COERCES
every element — a wire-supplied `{"toString":"x"}` therefore threw a bare
40-char `TypeError` from the line that BUILDS the write-verify diagnostic,
before the loud message could run at all (offline 47 → **48**; the same mismatch
via a benign element gave 418 chars). (2) The live quota case compared
`end === start` against a baseline taken BEFORE the custom demo slot existed, so
a fresh account's first run went red and blamed the trap case's cleanup, which
had actually succeeded — reproduced live at `start=0 end=1` (exit 1) and green
on the identical condition after the fix. The other three were docs-honesty
defects, including a catalog-mapping table in the CAMARA proposal whose
illustrative response shape M1 would have rejected outright, under a sentence
claiming the PoC produced it.

A **post-gate code review round (2026-08-17)** then closed two more adapter
defects, both redaction-order siblings of earlier fixes: `joinStored()` clamped
stored `countryName` strings BEFORE `redact()` saw them (a >48-char credential
echoed off the wire rode an un-redactable 48-char fragment into the write-verify
diagnostic — reproduced red, green after redact-first), and `tokenFor()`'s body
read sat outside the try that redacts (the unfixed sibling of the `post()`
/security Low). It also hardened the live check: the raw admin token bootstrap
now fails loud on a bad status/shape instead of caching `undefined` (which made
case 11 blame quota for an auth fault), the courtesy re-script after case 11 is
guarded so a transient failure cannot eat an all-green tally, and case 11 no
longer conjoins the at-cap check (reported as a warning instead). A third
adapter defect, adjudicated after the round, bounded `assertNow()` at
`MAX_EPOCH_MS` — a safe integer past `Date`'s range replaced the module's loud
named-input message with a bare `RangeError`. Counts are unchanged (48/11);
these fixes are why the user re-ran the runbook a second time, at `8e842c3`.
**M6 is BUILT (2026-08-17)** — `poc/demo.mjs` and `poc/m6-check.mjs`; see the
demo section above. The measured
Playground findings below were **re-verified live on 2026-08-16** before M5 was
written: seven held, **three changed**, one was not re-tested. Every change is
flagged inline with **CHANGED 2026-08-16**; the full spike record (with the
raw shapes) is the dated findings entry.

Node ≥ 20, zero dependencies, real crypto (`node:crypto`: Ed25519 signatures,
RSA-4096 OAEP-SHA256 envelopes for the end-to-end leg past the hub — one
vetted primitive, per the PRD decision log). The runbook is the demo section
above.

## The wired predicate set (six, 2026-08-17)

Every one is backed by an endpoint OBSERVED answering live on the Orange
Playground; nothing is wired for a fact no source computes.

| Predicate | Question | Menu | Live source |
|---|---|---|---|
| `simSwapAge` | SIM in place ≥ a bucket | `P30D P90D P180D P365D` | sim-swap `/check` under the 2400-hour cap, `/retrieve-date` above it |
| `deviceSwapAge` | device in place ≥ a bucket | same four buckets | device-swap `/check` / `/retrieve-date` |
| `roamingIn` | in this country set | — (a set has no ordering to bisect) | device-roaming-status |
| `presentIn` | inside this area | — (see the residual below) | location-verification `/verify` |
| `numberMatch` | claimed name matches ≥ a threshold | `60 70 80 90` | kyc-match `/match` |
| `reachable` | reachable = true/false | — (already one bit) | device-reachability-status |

Five rules bind all six, without exception: **(1)** the answer is a signed boolean
or a refusal — never a value, a score or a date; **(2)** an off-menu threshold is
refused LOUDLY and never rounded to the nearest bucket; **(3)** anything the
operator cannot answer honestly is a refusal (a straddling band, a missing fact,
location's `PARTIAL`); **(4)** the operator publishes the floor and the requester
may only tighten; **(5)** raw values the operator legitimately holds stay
operator-side.

`tenure` and `simType` stay OUT for a measured reason: the data exists
operator-side and no CAMARA read endpoint for it does.

**Two residuals this set adds, stated rather than closed.** `presentIn`'s AREA is
a dial (centre plus radius) and is walkable toward a position the way a duration
threshold is bisectable; it gets no bucket menu, so the cap is the operator's own
resolution plus rate-limiting and per-query billing — weaker than the duration
menu. And `numberMatch` discloses in the OTHER direction: the operator learns what
the requester claims, which is inherent to a comparison.

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
- **orange**: the Playground's sim-swap (`/check` under the measured 2400-hour
  cap, `/retrieve-date` above it), device-swap, device-roaming-status and
  device-reachability-status APIs — one live CAMARA read per fact axis, none
  stubbed; backstories set via its Admin API, and every write READ back and
  compared before it is trusted. **`deviceSwap:{latestDeviceChange}`,
  `kyc:{name}` and the full `location` shape are now MEASURED-GOOD**, corrected
  2026-08-17 from ASSUMED by a throwaway live convergence probe (the user,
  `+990100000099`, raw captures in the findings log): the probe kept
  re-submitting the same Admin UPDATE, one 400 at a time, until it converged —
  round 1 named `lastLocationTime` missing, round 2 named `available` missing,
  round 3 answered `200 OK` and a READ-back returned all three sub-objects
  intact. The settled `location` field set is `{latitude, longitude,
  lastLocationTime, available, radius}`: `available` is written `true`, and
  `radius` is written `500` — the ONE decision made outright rather than
  copying the probe's own placeholder `0`, because radius is the position's
  accuracy and a zero-radius write would claim a precision the operator never
  asserted. `available` and `radius` join the read-after-write loop as their
  own axes, same as `geoAt`. Still ASSUMED and unmeasured: three CAMARA
  READ request-body shapes — `{phoneNumber, maxAge}` for the two `/check`
  routes, `{device, area}` for `location-verification/v1/verify` and
  `{phoneNumber, name}` for `kyc-match/v1/match` (all mirrored from measured
  siblings or from CAMARA's own spelling; these are read-side request bodies,
  not the Admin write shapes the convergence probe settled). Read-after-write
  verification stays wired regardless of a shape's measured status — a
  regression on a measured-good axis still fails LOUD naming it, not just a
  wrong guess.
  **The generalisable lesson stands, refined rather than reversed:** an
  observed READ shape did not tell the write field set for `location` — that is
  why the first live run's `{latitude, longitude}` guess was refused — but a
  CONVERGING PROBE (submit, read the one missing field the 400 names, add it,
  resubmit) closed the gap in three rounds instead of three separate live
  gate runs.
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
findings stand here as dated evidence. **Re-verified live 2026-08-16 before M5
was built**; entries that changed are marked **CHANGED 2026-08-16** and the old
claim is left visible rather than quietly rewritten.
Everything below is captured behaviour; where it contradicts the docs, this wins.

- **Token** — `POST https://api.orange.com/openidconnect/playground/v1.0/token`
  with `Authorization: Basic <cred>`, `Content-Type:
  application/x-www-form-urlencoded`, body `grant_type=client_credentials` →
  `{access_token, expires_in: 3600}`. **CHANGED 2026-08-16:** M5 caches the
  token but does NOT refresh it on a timer — the old "refreshed a minute early"
  needed a wall clock in a module whose clock is supposed to be injected.
  Refresh is driven by the server's own `401` instead (invalidate, re-exchange
  once, retry once, then fail loud), which also covers a token revoked before
  it expires.
- **NEW 2026-08-16: the stored credential is ALREADY `Basic `-prefixed.** Line
  1 of the `pass` entry — exactly what the runbook's `| head -1` yields — is
  `Basic <base64>`. A naive `Basic ${cred}` therefore sends `Basic Basic …`,
  and BOTH token endpoints reject it (`400 invalid_request` /
  `401 "Basic authentication is malformed"`). The adapter strips an optional
  leading `Basic ` so either form works.
- **Two token endpoints, NOT interchangeable.** The Admin API rejects the
  CAMARA playground token with `401 UNAUTHENTICATED`; it wants a token from
  `https://api.orange.com/oauth/v3/token` (same Basic credential, same grant).
  The adapter therefore holds one token per surface. Only a `401` means
  expiry — on it, re-exchange once and retry once, then fail.
- **Sim-swap** — `POST .../camara/playground/api/sim-swap/v1/retrieve-date`
  with `{"phoneNumber":"+990…"}` → `{"latestSimChange":"<ISO-8601, ms>"}`.
  ~~That single call satisfies the whole facts interface.~~ **CHANGED
  2026-08-16: it does not, because it no longer has to.** All three fact axes
  are WIRED on this app — `POST .../api/device-roaming-status/v1/retrieve` →
  `{"roaming":bool, countryCode?, countryName?}` and `POST
  .../api/device-reachability-status/v1/retrieve` →
  `{"reachabilityStatus":"CONNECTED_DATA|CONNECTED_SMS|NOT_CONNECTED"}`, both
  under the app's own token scopes. **Nothing in M5 is faked or stubbed.** Note
  the shapes differ: sim-swap takes a bare `phoneNumber`, the two device-status
  APIs take a `{"device":{"phoneNumber":…}}` WRAPPER (the bare form answers
  `400 INVALID_ARGUMENT "phoneNumber is not allowed"` — which is how a real
  endpoint was told apart from a missing one, `400 "unhandled path"`).
- **`403 {"code":"FORBIDDEN"}` on sim-swap means UNKNOWN NUMBER**, not an auth
  failure — the adapter says so in as many words, because reading it as an
  auth problem sends you debugging the wrong thing. **CHANGED 2026-08-16 —
  NARROWED: the status alone is no longer enough.** Two different faults share
  `403`, and only the MESSAGE separates them: `"+990… does not exist for
  <client_id>"` is an unknown number, while a request carrying the WRONG
  SURFACE's token answers `"Request must be authorized"`. Treating every 403 as
  an unknown number puts you back in the exact wrong-thing-debugged failure
  this finding exists to prevent, one layer in. M5 classifies on the message.
- **NEW 2026-08-16: `roaming` has THREE states, and two of them are not the
  same "no".** `{"roaming":false}` is an honest NOT ROAMING; `{"roaming":true,
  "countryName":["FR"]}` is a country; **`{"roaming":true}` with no country is
  ROAMING, COUNTRY UNKNOWN** — genuinely produced by the Playground. In the
  facts shape the first is `roamingCountry: null` (a PRESENT key) and the third
  is an ABSENT key, because folding the third into `null` answers "not roaming
  in FR" about a subscriber who may be standing in France.
- **NEW 2026-08-16: `countryName` is a NAME list and `countryCode` is
  unusable.** The built-in records carry `["Spain"]`, not `["ES"]`; and the
  codes are internally inconsistent (built-in Spain = `34`, the DIALLING code;
  a scripted France = `208`, the MCC). M5 accepts a country only when it is a
  single canonical ISO-3166-1 alpha-2 code, and reads/writes no `countryCode`
  at all. `["Spain"]` and multi-country `["FR","MC"]` both leave the axis
  unavailable rather than guessing.
- **NEW 2026-08-16: an Admin `UPDATE` REPLACES a sub-object, it does not
  merge.** Writing `{"reachability":{"reachabilityStatus":…}}` drops the
  `lastStatusTime` that was there — so M5 writes all three axes in one call.
- **`/check`'s `maxAge` is in HOURS, capped at 2400** (≈100 days) — measured,
  not clearly documented. A 90-day floor is `maxAge: 2160`. The adapter does
  not use `/check` (a floor above ~100 days would be uncomputable there);
  it takes the date and windows it locally. ~~**NOT RE-TESTED 2026-08-16**~~
  **RE-TESTED AND BOUNDARY-TESTED 2026-08-17**, on sim-swap AND device-swap:
  `maxAge=2400` → `200`, `maxAge=2401` → `400 "maxAge" must be less than or
  equal to 2400`. So `/check` can serve the `P30D` and `P90D` buckets of the
  published menu and cannot express `P180D` or `P365D` at all — arithmetic, not
  preference.

### NEW 2026-08-17 — standalone endpoint sweep (`+990100000099`, no repo imports)

Two throwaway probes that import nothing from this tree, so nothing below is an
artefact of the adapter's own parsing. Full verbatim capture in
`docs/01-product/findings.md` (dated entry). **Nothing here is wired yet.**

- **`sim-swap/v1/retrieve-age-band` DOES NOT EXIST** — `400
  {"code":"BAD_REQUEST","message":"unhandled path"}`, the same not-wired signal
  the 2026-08-16 spike used to tell a missing route from a real one rejecting a
  bad shape. This closes an item the docs carried as UNVERIFIED, and the answer
  is the unflattering one: the coarse surface the profile would prefer is absent
  here, so band → bucket mapping stays mock-only or documented, never claimed.
- **`/check` exists and answers on both surfaces** — `sim-swap/v1/check` →
  `{"swapped":false}`, `device-swap/v1/check` → `{"swapped":true}`.
  `device-swap/v1/retrieve-date` → `{"latestDeviceChange":"2026-08-11T…"}`.
- **`kyc-match/v1/match` returns a similarity GRADIENT, not a band.** Correct
  name `"Alice Arnaud"` → `{"nameMatch":"true"}` (no score); `"Bob Wrong"` →
  `{"nameMatch":"false","nameMatchScore":53}`; `"Alice Arnaut"` — one letter
  changed — → `{"nameMatch":"false","nameMatchScore":97}`. A requester allowed
  to guess repeatedly can hill-climb that to the registered name, which is
  strictly worse than binary guessing. This is why the CAMARA proposal now
  carries a visible retraction of "scores are already bands". On this sandbox
  `givenName`/`familyName`/`birthdate`/`address` all answer `not_available`
  (only `name` is stored), `email` → 400 validation error, and an empty request
  → `400 KNOW_YOUR_CUSTOMER.INVALID_PARAM_COMBINATION`.
- **`location-verification/v1/verify` has THREE states.** Paris r=10km →
  `TRUE`; Tokyo r=10km → `FALSE`; Paris r=1km → `TRUE`; Paris r=100m →
  `{"verificationResult":"PARTIAL","matchRate":100,…}`. And **every** response
  ships `lastLocationTime`, a raw timestamp — a "boolean" catalog endpoint
  handing back a raw value beside its verdict. Operator-internal only.
- **`number-verification/v1/verify` exists** — `403 "Request must define a
  phoneNumber"`, i.e. the 3-legged shape where the subject comes from the token.
  Not a missing endpoint.
- **No CAMARA read endpoint for tenure** — `tenure/v1/retrieve` and
  `sim-tenure/v1/retrieve` both `400 "unhandled path"`; likewise
  `kyc-age-verification/v1/verify` and `device-location/v1/retrieve`. The tenure
  DATA is there operator-side (Admin READ axes: `location, reachability,
  roaming, simSwap, deviceSwap, tenure, kyc`; `tenure` holds
  `latestTenureChange` + `contractType:"PAYM"`, `kyc` holds
  `name:"Alice Arnaud"`) — which is exactly why `tenure`/`simType` stay OUT of
  the wired predicate set: admin-only is not catalog-backed.
- **Backstories** — `POST .../camara/playground/admin/v1.0/action` with
  `LIST | CREATE | READ | UPDATE | DELETE`. `UPDATE {"data":{"simSwap":
  {"latestSimChange":"<ISO>"}}}` sets the swap date. `DELETE` answers `204`
  with an empty `text/html` body — read it as text, never `res.json()`.
- **THE TRAP: built-in numbers silently ignore writes.** The built-in cast
  (`+990100000000`–`…05`) answers `CREATE`/`UPDATE` with `200`/`201` echoing
  your payload back, while the stored dataset never changes — sim-swap keeps
  returning the built-in date (and a `LIST`ed custom entry for such a number
  is shadowed by the built-in). **The echo is never proof.**
  **CHANGED 2026-08-16 — HOLDS, mechanism sharper.** A bare `UPDATE` on a
  built-in the app has never claimed now fails LOUD (`400 BAD_REQUEST
  "PhoneNumber Not Found"`), which the original wording did not describe. But
  the adapter's own path is CREATE-then-UPDATE, and that reproduces the trap
  exactly: `CREATE` → `201` echoing a fabricated default template, `UPDATE` →
  `200` echoing the date you wrote, and the very next `READ` → the built-in's
  own dataset (`2020-03-15T10:00:00.000Z`, `"Bernard Blanc"`,
  `countryName:["Spain"]`), with sim-swap agreeing with the READ. Replayed
  2026-08-16 on `+990100000002`: **echo carried the write, READ did not**; the
  same sequence on the custom slot had all three agree. So the adapter
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
