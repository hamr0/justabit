# PoC — Mode A, four assertions, one command

**v3 working copy, copied unchanged from `camara/v2/poc` on 2026-11-23 (commit `a4283fb`); `camara/v2/poc` stays frozen. V3-M1 and V3-M2 have since changed `m1-jws.mjs`, `m1-jws-check.mjs` and `README.md`, V3-M2b rewrote `m2-envelope.mjs` and changed `m2-check.mjs`, `m6-check.mjs`, `m1-jws-check.mjs` and `demo.mjs`, and V3-M2 added `menu.mjs`, `menu.json` and `menu-check.mjs` (see below); the other modules are still the v2 code, with only their run-line paths changed to `camara/v3/poc`.**

**2026-11-24 — V3-M2b (sealed envelope, one fixed size).** `m2-envelope.mjs` is now a
JWE (RFC 7516) in compact form: `alg` `RSA-OAEP-256`, `enc` `A256GCM`. A fresh
256-bit content key per message encrypts the payload with AES-256-GCM (fresh
96-bit IV, the header as AAD); RSA-OAEP-SHA256 wraps only that 32-byte key. So
every signed answer and refusal seals, including the worst-case Tenure answer
(461 B). Decision: user, 2026-11-24 (JWE; then ONE fixed envelope size, see
below). `seal`,
`open` and `generateEnvelopeKeys` keep their signatures. The `OAEP_CAPACITY`
export is gone: it was no longer a seal limit, and `demo.mjs`, `m6-check.mjs`
and `m2-check.mjs` no longer check against it. `open()` also checks the
lengths after decoding (IV 12 B, tag 16 B, padded body exactly 1024 B). Case 15
(a 14 B IV) and case 16 (a 1025 B body) each build a valid JWE of exactly the
sealed length (the RSA wrapped key's leading `0x00` bytes are dropped to pay for
the longer IV or body), so they reach ONLY those checks and are mutation-proven
(next section). `demo.mjs` lost its old size checks
(the RSA-3072 small-key step; 35 -> 34 assertions; the pre-seal
answer guard stays and now checks `MAX_PAYLOAD`), and `m6-check.mjs` case 29 lost its third assertion (the worst
refusal fits one RSA envelope).

One fixed size (review fix, 2026-11-24). Padding to the NEXT multiple of 1024
let the hub read the boolean at a bucket edge (a true answer of 1020 B sealed
to 2142 B, the false one of 1024 B to 3507 B), and `open()` had no size
bound. Now every payload is padded to exactly 1024 B (`0x80`, then `0x00`):
`MAX_PAYLOAD` is 1023 (exported), `seal()` throws above it, and every sealed
message is 2142 B for RSA-4096 (derived from the key modulus, not a constant:
1801 B for 2048, 1971 B for 3072). `open()` refuses any input that is not
exactly the sealed length for its private key, BEFORE any crypto (case 17: a
50 MB JWE is refused in under 1 ms, mutation-proven). `demo.mjs` refuses an
answer over the envelope with the TRUE signed reason `answer over the
envelope size` (`m6-check.mjs` case 48).

Five properties, each tested in `m2-check.mjs` with a negative control:
1. Length hiding: the payload is padded (`0x80`, then `0x00`) to exactly
   1024 B, so SimSwap true/false, Tenure true/false and a refusal all seal to
   one length, 2142 B (case 11; the control without padding gives 5 lengths).
2. One failure reason: any fault returns `undecryptable`, never throws (case 12:
   2,000 random flips across the five parts, wrong key, truncated, empty, a
   6th part, a different header, bad padding, non-canonical base64url; the
   control that reports the failing step gives 5 reasons). The header is one
   constant compared as text, there is no header parser, and each part must
   re-encode to the same base64url text.
3. Fresh key and IV: 1000 seals give 1000 distinct content keys (each
   encrypted key part is decrypted and compared, since RSA-OAEP output is
   randomized) and 1000 distinct IVs (case 13).
4. Round trip at 0, 1, 446, 461 and 1023 B, and payloads ending in `0x80` or
   `0x00` (case 14); one byte more throws at seal (case 1).
5. Sender faults throw: not a Buffer, not an RSA key (Ed25519, DSA), RSA under
   2048 bits (case 2).

Mutation-proven (each mutant turns `m2-check.mjs` red): no padding, header check
removed, per-step failure reason, fixed IV, padding marker not required, strict
base64url check removed, fixed content key (case 13), exact-length check in
`open()` removed (case 17), `seal()` size throw removed (cases 1, m6 48), the
RSA key-type check removed (case 2, DSA), the IV/tag length check in `open()`
removed (case 15 red; case 16 stays green), the plaintext-length check removed
(case 16 red; case 15 stays green), and both removed (cases 15 and 16 red).
Limit: the 15 B tag wire in case 15 is also refused by Node's `setAuthTag` when
the IV/tag check is absent, so the tag half of that check is not mutation-proven
by itself; the IV half is.

Honest limits: the hub still sees message count, timing and who talks to whom
(the metadata it needs to bill). There is one size: a payload over 1023 B is
refused by `seal()`, not sent in a bigger bucket. No timing-oracle defence is claimed (JS is not
constant-time; RFC 7516 section 11.5's random-key fall-through is left out on
purpose). It is a standard JWE profile, but no outside party has reviewed it.
`demo.mjs` keeps `clampReason` and `NONCE_JSON_MAX`: they bound signed
refusals built from wire input. Their numbers (122 and 70) were derived from
the old 446 B RSA limit and are kept as they are; whether to re-derive them is
an open item (3).

Open items of the fixed size, documented and not hidden:
1. The mutant "pad to the next multiple of 1024, `seal()` throw kept" is
   EQUIVALENT: for a payload of 1023 B or less it pads to the same 1024 B, and
   larger payloads still throw, so no test can fail on it. Documented, not
   killed.
2. At the edge a true answer can fit while the 4 B longer false answer is
   refused. The hub sees one length (2142 B) either way; the requester sees
   an answer versus the signed refusal, and it is entitled to the bit.
3. `clampReason` and `NONCE_JSON_MAX` (122 / 70) stay as derived from the old
   446 B limit.

The RFC 7516 Appendix A.1 decryption check was run in the
spike only (SHA-1 there; the module has no hash option).

```
node camara/v3/poc/m2-check.mjs        # V3-M2b sealed envelope - 17 cases
node camara/v3/poc/m6-check.mjs        # 48 cases (V3-M2b added 48, the over-size refusal)
node camara/v3/poc/m1-jws-check.mjs    # 385 cases (385 at V3-M2; V3-M2b added 33b2, dropped 33)
```

**2026-11-23 — V3-M2 (published menu).** The operator publishes the questions
it answers as a short closed set of durations per API (not a range: a range
lets a requester find the raw date by asking again with a moved value).
Default menu = the agent floor: SimSwap `P90D`, Tenure `P2Y` (`menu.json`,
same content as `DEFAULT_MENU` in `menu.mjs`). An operator may publish more.
The menu is keyed by the schema `api` value from `m1-jws.mjs`
(`sim-swap/v2/check`, `kyc-tenure/v0.3/check-tenure`): one name for one thing,
so `SIM_SWAP_CHECK.api` goes straight into `entryFor`, `answerWithMenu` and
`attestRefusal`. The old short names `simSwap` / `tenure` are refused by
`loadMenu` and `checkMenu`.

- The requester still sends the Sync26 request body. `checkMenu`, `entryFor`
  and `answerWithMenu` take the WHOLE body (for example `{phoneNumber, maxAge,
  nonce}`) and read ONLY the API's own field (`maxAge` hours; `tenureDate`) as
  an own property (an inherited one, or `__proto__` via `JSON.parse`, does not
  count). Other keys are ignored: never signed, never passed to `readBackend`,
  which gets only `(api, entry)`. A body without the field is refused: Sync26's
  240 h `maxAge` default (P10D) is not on the default menu, and a default the
  requester did not ask for is not a question it asked.
  `menu.mjs` maps the field to the menu entry BEFORE any backend read. Off menu is
  `OUT_OF_RANGE`: never rounded, nothing read. Dates are UTC only.
- Signed shape (user decision 2026-11-23, "sign `entry` only"): the answer
  is `iss, aud, nonce, iat, exp, api, entry, <answer>`. `maxAge` and
  `tenureDate` are NOT signed, so no hours value and no date appears in any
  signed answer or refusal. This changes the V3-M1 signed shape.
- Signed refusals are now API-bound: `attestRefusal(..., error, api)` writes
  `api`; `verifyRefusal` takes `expectedApi` and rejects a mismatch
  (`API_MISMATCH`). `OFF_MENU_THRESHOLD` is renamed `OUT_OF_RANGE`.
- `loadMenu` throws on a bad entry, `P0D`, a SimSwap entry above the 2400 h
  cap (for example `P365D`; `P100D` loads, `P101D` throws), or a Tenure entry
  above `P100Y` (no line is older than 100 years; keeps the UTC date math in
  range).
- `loadMenu` accepts a menu that omits an API (the operator does not offer
  it; `checkMenu` refuses every question for it). A list that is present must
  still be non-empty. `checkMenu` runs a given `ctx.menu` through `loadMenu`;
  if that throws, the question is refused.
- Requester side: call `entryFor` when the request is BUILT, with the same
  `today` used to compute `tenureDate`, and keep the result as
  `expectedEntry` for `verifyAnswer`. Recomputing it at verify time fails
  with `ENTRY_MISMATCH` across UTC midnight.
- Wire input never throws. A caller bug does: a Tenure question with a
  missing or invalid `ctx.today` (not a `Date` with a valid time) throws
  `TypeError`, so a wiring mistake is not hidden as `OUT_OF_RANGE`. SimSwap
  questions need no `today`.
- `thresholdR` and the requester's `tenureDate` must be real calendar dates
  (`isCalendarDate`, exported from `m1-jws.mjs`): `2024-13-01`, `2024-00-01`,
  `2024-02-30` refuse.
- The signer does NOT check the menu. `attestAnswer` and `attachAttestation`
  sign any positive duration as `entry` and do not apply the per-API cap; an
  operator MUST call `answerWithMenu` first and sign only the entry it returns.
  V3-M4 (caller migration) joins the two.
- The V3-M1 bullets below that say refusals are API-unbound or that
  `TENURE_CHECK` signs a `tenureDate` of type `date` are history; V3-M2
  replaces them. The `date` type stays in the library but no named schema
  uses it.
- Closed by V3-M2b (2026-11-24): the worst-case Tenure signed answer (461 B) was
  over the 446 B RSA-4096 OAEP cap of the v2 envelope; the hybrid JWE envelope now
  seals it. `33` (a size guard against the old cap) is dropped, as it duplicated `33d`;
  `33b` now asserts the worst refusal seals to the same length. `33b2` asserts it seals and opens to the same bytes; `33c` asserts it
  seals to the same length as the SimSwap answer; `33d` stays the control.
- Requester side (F1): `verifyAnswer` takes `expectedEntry`. For a schema
  whose params include `entry` it is required, and must equal the signed
  `entry`, else `ENTRY_MISMATCH`. The requester gets it from
  `entryFor(api, body, ctx)` in `menu.mjs` (its own request field mapped
  through the same published menu; `null` if off menu). Without it a valid
  answer to a different question could pass.
- Refusal APIs (F3): `KNOWN_APIS` (exported from `m1-jws.mjs`) is the closed
  set of API names a refusal may carry. `attestRefusal` and `verifyRefusal`
  reject any other `api` with `INVALID_API`.
- One duration grammar (F7): `parseDuration` lives in `m1-jws.mjs`, and
  `menu.mjs` imports it. The signer checks `entry` is a positive duration;
  the per-API caps (SimSwap 2400 h, Tenure P100Y) stay in `menu.mjs`.
- `loadMenu` treats `['P1Y','P365D']` as a duplicate (compared in days).

```
node camara/v3/poc/menu-check.mjs      # V3-M2 published menu — 46 cases
node camara/v3/poc/m1-jws-check.mjs    # 385 cases at V3-M2 (314 at V3-M1 + V3-M2 rewrites and additions); 385 at V3-M2b
```
Run both also under `TZ=Pacific/Kiritimati` and `TZ=America/Adak`.

**2026-11-23 — V3-M1 (signed answer).** Caller migration (M2/M6/`demo.mjs`
onto the JWS core) is V3-M4 (user decision 2026-11-23), not V2-M3: until then
M2/M6/`demo.mjs` still run on the raw-Ed25519 envelope (`m1-attestation.mjs`).
V3-M1 changes `camara/v3/poc/m1-jws.mjs` as follows:

- The answer payload is no longer seven claims; it carries `api` too, after
  the base claims and before the question and answer claims. Claim order is
  not load-bearing for verification: `attestAnswer` with a base of
  `iss, aud, nonce, iat, exp` signs `iss, aud, nonce, iat, exp, api, ...`;
  `attachAttestation` signs `iss, aud, iat, exp, nonce, api, ...`.
- `attestation` is a reserved claim name, exactly as `api` is: a schema that
  names it, or a caller who supplies it, is rejected with `RESERVED_CLAIM`
  (through `attachAttestation`: `AttestationFailed` with that cause).
- Two exported answer schemas, each with a fixed `api` value:
  `SIM_SWAP_CHECK` (`sim-swap/v2/check`) and `TENURE_CHECK`
  (`kyc-tenure/v0.3/check-tenure`).
- `verifyAnswer` rejects a payload whose `api` differs from the schema's with
  the typed code `API_MISMATCH`.
- `attachAttestation(body, nonce, opts)` (opts = `{ privateKey, kid, base,
  schema, params }`) BUILDS the signed response; it never filters `body`.
  With a nonce, the response holds only the `schema.answer` keys (each read
  once from `body`, and it must be an own key) and `attestation`, last.
  Nothing else from `body` is copied: Tenure's `contractType`, a raw field, a
  Symbol key, a `__proto__` key or a forged `attestation` never reach the
  requester beside the signature. Every `schema.answer` value in the response
  equals the verified claim. `schema.api`, `schema.params` and `schema.answer`
  are read once, so a getter cannot make the response and the signature differ.
- With a nonce of `undefined` (and only that), the call returns a plain copy
  of `body`, unchanged: today's Sync26 response, not profile mode. Nothing
  else is checked on that path.
- Any other nonce that is not a non-empty string (null, `""`, 42) throws
  `AttestationFailed` before `opts` is read. A missing answer key, a `base`
  that is not a plain object or carries its own `nonce`, a throwing getter on
  an answer key or on `opts`, a null `opts`, or `attestAnswer` not returning a
  token also throw `AttestationFailed` (the underlying reason rides along as
  `cause`). A body that is not a plain object, or whose plain-object check
  throws (a Proxy trap), throws `TypeError`; nothing else escapes.
- Signed refusals stay API-unbound until V3-M2.
- M1 signs any well-typed question; the allowed range (maxAge 1-2400 h,
  tenureDate from the operator's threshold R to today) is enforced by the
  V3-M2 menu, not M1.
- `TENURE_CHECK.params.tenureDate` is now type `date`: `YYYY-MM-DD` and a real
  calendar date (`2024-02-30`, `2024-1-01`, a timestamp, `""` fail with
  `WRONG_TYPE`).
- A schema must carry an OWN `api`; an inherited one (a polluted
  `Object.prototype.api`) is refused with `MALFORMED_INPUT`.

User-validated 314/314 for `m1-jws-check.mjs` (2026-11-23, findings
2026-11-23). No earlier user-validation record applies to v3: every
"user-validated" or "LIVE-CONFIRMED" note below is dated history of the v2
tree, kept as written.

```
node camara/v3/poc/m1-jws-check.mjs   # V3-M1 JWS attestation core — 314 cases
                        #   (user-validated 314/314, 2026-11-23)
```

**Requirements & no-gos:** [`docs/product/prd.md`](../../docs/product/prd.md) §4–§5.
**Status:** all six modules M1–M6 are BUILT — a first build was
**rolled back 2026-08-15** (it went monolith-then-integrate without
per-module user validation; see PRD §4.4 and the decision log) and the ladder
since then has held: each module is POC'd against its toughest assumption,
built, proven end-to-end on its own, and **validated by the user before the
next module starts**. **Both gates were MET, on the v2 tree, at code commit `4446517` /
docs commit `c921508`: the user ran the full validation suite on their own
machine (log timestamped 2026-08-18 08:16) — every suite clean, zero `FAIL`,
zero `TypeError`, zero `Error:` lines in the entire log.** Gate G1 (M1–M4 + M6
all user-validated) was MET at those v2 counts; gate G2 (M5 user-validated
live) was MET on both legs (offline and live) there. No gate is met for v3
until the user runs it. That was the first time in this
project both gates have been met at the same commit, on a tree that had
already been through two `/code-review` rounds with every fix
mutation-proven. This record covers `4446517`/`c921508` only, per this
repo's standing rule that a user record does not transfer to a later change;
see `docs/logs/findings.md`, 2026-08-18 (latest). Every check runs on
its own (negatives first, exit 0 only if every case holds):

```
node camara/v3/poc/m1-check.mjs   # M1 attestation core — 20 cases (user-validated 20/20 at
                        #   `4446517`, 2026-08-18) (v2 tree, not re-run on v3)
node camara/v3/poc/m2-check.mjs   # M2 blind envelope — 17 cases (V3-M2b; the
                        #   v2 10/10 validation does not transfer)
node camara/v3/poc/m3-check.mjs   # M3 floor gate — 26 cases (user-validated 26/26 at
                        #   `4446517`, 2026-08-18) (v2 tree, not re-run on v3)
node camara/v3/poc/m4-check.mjs   # M4 mock facts adapter — 42 cases (user-validated 42/42 at
                        #   `d85d3cf`/v0.5.0, 2026-08-18) (v2 tree, not re-run on v3)
node camara/v3/poc/m5-check.mjs   # M5 orange facts adapter, OFFLINE — 67 cases (user-validated
                        #   67/67 at `d85d3cf`/v0.5.0, 2026-08-18). (v2 tree, not re-run on v3)
                        #   Zero credentials, zero network:
                        #   an injected transport replays responses captured live on
                        #   2026-08-16, so it runs on a clean clone.

# M5 LIVE — the G2 gate. Talks to the real Orange Playground.
# `| head -1` because a `pass` entry is multi-line (secret on line 1, notes below).
# The stored value is ALREADY `Basic <base64>`; the adapter normalizes either form.
ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node camara/v3/poc/m5-check-live.mjs
                        # 19 cases (11/11 user-validated at 8e842c3, the shipped
                        # v0.3.0 state — that met G2 AT THAT TREE. The 3 -> 6 round
                        # never touched this file: the user's live run of it died on
                        # M5's own closed-field validation, so it was rewritten
                        # (11 -> 19, all six predicates on the live path, plus an
                        # OFFLINE case 1 pinning the story against the adapter's
                        # closed field set). LIVE-CONFIRMED at `3276ed0`: the user
                        # re-ran this file live against the real Playground there and
                        # got 19/19 (quota clean, start=1 end=1 of 10). Two
                        # code-review rounds then changed poc/m5-facts-orange.mjs and
                        # poc/demo.mjs after `3276ed0`, re-opening G2 through
                        # `9b04854` and `4446517` — closed again by a fresh full user
                        # run: LIVE-CONFIRMED AGAIN at `4446517`/`c921508`
                        # (2026-08-18 08:16), 19/19. G2 IS MET at `4446517` — see
                        # docs/logs/findings.md, 2026-08-18 (latest). (v2 tree, not re-run on v3)
                        # exit 2 + printed prerequisites if the credential is absent —
                        # never a silent pass, never a mock fallback.
                        # COSTS QUOTA: consumes and returns one of the app's 10 custom
                        # slots. It reclaims the slot BEFORE consuming it (so an
                        # interrupted run does not leak one), prints the count at both
                        # ends, and case 19 asserts it came back.

node camara/v3/poc/m6-check.mjs   # M6 integration — 48 cases (V3-M2b; the v2 history below does
                        #   not transfer). v2 history: 47 cases (user-validated 47/47 at
                        #   `d85d3cf`/v0.5.0, 2026-08-18 — case 46 CROSS-REQUESTER
                        #   SEALING added earlier, second code-review round, 45 -> 46;
                        #   case 47 CONDITIONAL AXIS READ added in the M7 round, 46 -> 47). (v2 tree, not re-run on v3)
                        #   Zero credentials, zero network in BOTH
                        #   backend modes: the `--backend orange` seam runs
                        #   through an injected transport replaying captured
                        #   Playground bytes, exactly like m5-check. It also runs
                        #   the demo itself and asserts its exit code, that its
                        #   RESULT line is n/n (parsed, not a fixed count; the demo is
                        #   34/34 on v3), and claims discipline (every mention of
                        #   zero-knowledge in the output must be a negation).
                        #   Takes ~15s — RSA-4096 keygen dominates.
```

## The demo — `node camara/v3/poc/demo.mjs`

```
node camara/v3/poc/demo.mjs                    # mock backend: zero credentials, zero network

# live: Orange Network APIs Playground. `| head -1` because a `pass` entry is
# multi-line (secret on line 1, notes below) — the adapter also defends itself
# by using line 1 only, but a whole entry in a header makes fetch throw a string
# quoting the notes.
ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node camara/v3/poc/demo.mjs --backend orange
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

**Honest limit — the requester nonce store only grows.** A nonce is deleted when its
response is verified, so a request that never receives one (rejected by the hub,
dropped in transit, answered after the requester gave up) leaves its entry
resident forever. Harmless across a handful of demo requests, unbounded in
anything real; a deployment evicts on expiry, since the answer's validity window
is already the natural TTL. Stated rather than built — exercising a TTL would
mean faking elapsed time, and a stated limit beats an untested one.

The mock run is **AGENT-RUN 33/33 exit 0.** The user's first live
`--backend orange` run (2026-08-17) scored 32/33 — one negative control (the
assertion-1 leaky-operator flip) was VACUOUS on that backend, not a profile
defect: it asked a `P90D` question, which runs `/check` on orange and never
holds a raw date to leak, so the control's asserted condition was false. Fixed
in `poc/demo.mjs` (dedicated `LEAK_PREDICATE` at `P365D`, which forces
`/retrieve-date`) and mutation-proven offline via an injected-transport
replay — see `docs/logs/findings.md`, 2026-08-17. **The fix was
LIVE-CONFIRMED: the user re-ran `node camara/v2/poc/demo.mjs --backend orange` at tip
`3276ed0` and reported `RESULT: 33/33`** — the vacuous control reds the
leak for real on the live backend. That record does NOT transfer forward:
the 2026-08-18 code-review round changed `poc/demo.mjs` itself after
`3276ed0` (four fixes landed in this file — see the count/gate note above),
so the demo's own live run went PENDING again at `9b04854`. **That has since
been closed: the user re-ran `node camara/v2/poc/demo.mjs --backend orange` at
`4446517`/`c921508` (2026-08-18 08:16) and reported `RESULT: 33/33` — see
`docs/logs/findings.md`, 2026-08-18 (latest), which also records why
gate G2 is now MET.**

The **M6 round (2026-08-17)** then changed two of those modules, so two counts
moved: M1 gained case 20 (its duplicate-key scanner is now EXPORTED, so a signed
REQUEST can be checked for the same equivocation) and M3 gained case 23 (its
declared fix point — the rejection-message builder threw a bare `TypeError`
instead of producing the loud named-input rejection). Both were **AGENT-RUN by
exit code with a user re-run PENDING at the time** — since closed, along with
every later count move, by the full user run at `4446517`/`c921508`
(2026-08-18 08:16): see the status note at the top of this file.

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
check declares its case count (`conclude(20|10|26|42|67|20|47)`) so a suite that
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
gate G2, and it WAS met at that tree.** The 3 → 6 predicate round then changed
the module, and the user's live run of that round found the Admin `location`
write shape was wrong (`400 "data.location.lastLocationTime is required"`); the
fix landed after the run, so `8e842c3`'s record did not transfer forward and G2
went PENDING a re-run. **That re-run has since happened: the user ran
`m5-check-live.mjs` live against the real Playground at the current tip
`3276ed0` and got 19/19 (quota clean) — G2 IS MET again, at `3276ed0`, and
nothing about it is pending.** See `docs/logs/findings.md`, 2026-08-18.
**That record then went PENDING again** — the 2026-08-18 code-review
round changed `poc/m5-facts-orange.mjs` after `3276ed0` — **and has since been
closed a third time: the user re-ran `m5-check-live.mjs` live at
`4446517`/`c921508` (2026-08-18 08:16) and got 19/19. G2 IS MET at
`4446517`.** See the status note at the top of this file and `findings.md`,
2026-08-18 (latest).
That earlier run also exposed a
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
[requester demo "bank"] ──(predicate + floor + nonce, encrypted)──▶ [blind hub] ──▶ [operator shim]
                                                                     meters & "bills"    ┌───────────────┐
                                                                     ciphertext only     │ facts adapter │
[requester demo] ◀──(signed {predicate, result, nonce, exp}, encrypted)─────────────────┤ mock │ orange │
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
`docs/logs/findings.md` (dated entry). **Nothing here is wired yet.**

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
  phoneNumber"`, i.e. `/verify` is 3-legged and REQUIRES an identifier; the
  identifier-free shape lives only at `GET /device-phone-number`. Not a
  missing endpoint.
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
