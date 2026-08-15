# Findings log

Dated, append-only. What experiments actually showed — including what did
NOT work. Complements `prd.md` (which records decisions); this records the
evidence and the dead ends, so nothing gets re-tried or re-argued from
memory. A finding here is something that was RUN and OBSERVED, not reasoned.

---

## 2026-08-15 — M1 round-2 review (8 findings on the fix round + doc sweep)

A second review of the FIXED M1 (a fix round is the least-reviewed code)
found the fixes themselves sound but surfaced a deeper invariant hole and a
doc-drift class: **a design change (predicate-in-the-signature) must be
swept across EVERY doc surface in the same round** — spec sketch, normative
profile rules, README diagram, and PRD ladder all still described the old
shape.

1. **Raw-value smuggling through a valid signature.** A validly signed
   payload carrying `swapTimestamp` alongside the boolean VERIFIED CLEAN
   and handed the raw value to the caller — the repo's one invariant, open
   at its requester-side enforcement point. Fixed: closed claim set — any
   field beyond `{predicate, result, nonce, exp}` rejects.
2. **Incomplete response shape gate.** Only `signature === undefined` was
   caught; `null`/number/string signatures — and even a broken TRUSTED KEY
   (caller's own config) — misreported as the attack-shaped 'bad signature
   (malformed)'. Fixed: `Buffer.isBuffer` on the signature in the shape
   gate; the try/catch stays as a defensive backstop for broken caller keys
   (measured: a non-key makes `crypto.verify` throw).
3. **The check harness never asserted rejection REASONS** — collapsing
   'malformed response' into 'bad signature' (the exact regression case 1
   exists to catch) stayed green. Fixed: expected-reason assertions folded
   into pass/fail; happy-path fidelity folded into one verdict (no more
   possible PASS-then-FAIL double line).
4. **Spec sketch described a different signing mechanism than the PoC** —
   a field-tuple signature `(predicate, result, nonce, iat, exp, iss)` with
   optional members and no canonicalization is unimplementable as written.
   Fixed: sig restated as a detached signature over the exact payload bytes
   (sign-what-you-ship).
5. **The NORMATIVE profile (rule 2) never required the predicate echo** —
   the illustrative artifacts were stricter than the document that carries
   the rules; an implementer building to §3.2 alone stayed vulnerable to
   answer-substitution. Fixed: rule 2 now requires predicate echo + names
   the stateless-verification limit (single-use nonces are requester-side).
6. **README architecture diagram** still showed `signed {result, nonce,
   exp}` — the exact wire shape the check suite rejects as an attack. Fixed.
7. **PRD §4.4 M1 row** still claimed "replay … genuinely REJECT" for a
   deliberately stateless verifier. Fixed: row reworded to binding-only;
   the single-use-nonce obligation explicitly assigned to M6's RP side.
8. **`Predicate.value` was typed `string`** while its own example is the
   array `["FR","BE"]` — the schema couldn't express its documented
   set-membership case. Fixed: `oneOf` string | string-array.

Follow-up: the one flagged coverage gap (`unparseable payload` had no test,
since `attest()` can only produce valid JSON) was closed by signing
genuinely non-JSON bytes directly with `crypto.sign` — a valid signature
over garbage, proving the parse failure alone causes the rejection.
Mutation-proven to pin the exact branch: a mutant that still REJECTS but
with the sibling reason (`malformed claims`) turns only that case red —
a verdict-only assertion would have passed it. Final: 17/17, exit 0.

## 2026-08-15 — M1 review round (8 findings on the first M1 build)

A medium code-review of the freshly built `poc/m1-attestation.mjs` +
`poc/m1-check.mjs` surfaced 8 execution-verified findings. The lesson
class: **a verifier must type-gate every field of the signed claims — each
unguarded field was a real accept-what-should-reject hole.**

1. **`result` was never validated.** A validly signed payload with `result`
   missing, or `result: "false"` (a string), was ACCEPTED. A relying party
   branching on the claim reads `undefined` (falsy) or a truthy string —
   the opposite of what was attested. Fixed: `result` must be a boolean
   (matches the repo invariant: the answer IS a signed boolean).
2. **Nonce check failed open.** `claims.nonce !== expected.nonce` passes
   when BOTH are `undefined` — a caller that forgot to generate a nonce
   silently lost all replay binding. Fixed with a string type-gate.
3. **Verifier could throw on validly-signed weird payloads.** `attest(key,
   null)` signs the 4-byte payload `null`; the verifier then crashed on
   `claims.predicate` instead of rejecting. Broke the stated
   "reject, never throw, on untrusted input" invariant. Fixed with a
   non-null-object gate after parse.
4. **Wrong factual comment about `crypto.verify`** (see spike finding below
   — the module comment stated the unmeasured claim).
5. **The try/catch around `crypto.verify` had zero test coverage.** The
   "garbage signature Buffer" case exercises the ordinary `false` path, not
   the catch. The case that actually throws: a signature that is NOT a
   Buffer at all — e.g. a base64 string straight off a JSON wire. Covered
   now with its own case.
6. **PoC vs `spec/carrier-attestation.yaml` divergence.** The sketch's
   signed set was `(result, nonce, iat, exp, iss)` — NO predicate — so
   under the sketch, a signed answer to a DIFFERENT question verifies.
   Fixed: `predicate` added to the sketch's response + signed set.
   Deliberately NOT changed: the sketch's `exp` stays RFC3339 (WG-friendly,
   illustrative) while the demo uses unix-ms (deterministic tests); the
   divergence is format-only and recorded here on purpose.
7. **Caller/config errors were attack-shaped.** A broken trusted key
   (undefined, wrong type) rejected as "bad signature (malformed)" —
   pointing debugging at a nonexistent forger. Fixed: malformed responses
   get a distinct reason before the crypto call.
8. **The "REPLAY" test overclaimed.** It proves a response bound to nonce A
   does not verify against nonce B — nothing more. The verifier is
   STATELESS: re-presenting the same response against the SAME expected
   nonce within `exp` verifies again. Single-use, per-request nonces are
   the requester's job. Test renamed/reworded to what it proves; no
   nonce-consumption state added in M1 (honest limit, stated).

## 2026-08-15 — M1 throwaway spike (scratchpad, user-validated)

Ed25519 attestation core spike: 5 cases (tamper / replay-nonce / expired /
wrong key / happy), 3 guard-off negative controls, 1 sabotage run.

- **All 4 negatives genuinely reject, and each guard is load-bearing**:
  disabling each guard flips exactly its own case to wrongly-ACCEPT and
  nothing else. Sabotaged always-accept verifier → harness goes red, exit 1
  (the test can fail).
- **Measured (Node 22): `crypto.verify` returns `false` on a malformed
  signature *Buffer*** (7-byte, 64-byte random, empty). It THROWS
  (`ERR_INVALID_ARG_TYPE`) only when the signature is not a Buffer at all
  (string/number/null/object). The prior assumption ("throws on malformed
  buffer") was wrong — worth knowing because a base64 string off the wire
  is the realistic throwing input.
- **Sign-the-exact-bytes works with zero canonicalization**: serialize
  once, sign those bytes, ship those bytes, verify before parse. No JSON
  key-order problem exists in this shape.
- **Gap found by the spike's own tamper case**: with signatures disabled, a
  one-bit flip inside the KEY `"predicate"` still parsed as valid JSON with
  the right nonce/exp — i.e. a verifier that only checks sig/nonce/exp will
  accept an answer whose predicate field is renamed or missing. This drove
  the predicate-match check into the real M1 (and then finding 6 above
  drove it into the spec sketch).

## 2026-08-15 — G0 rollback (process, not code)

**What didn't work: building G1+G2 as a monolith, integrate-then-show.**
Modules chained without user validation between them; orchestrator-only
checks. Result: full rollback to G0, code archived out of the repo, the
M1–M6 ladder made binding (POC → user-approved spec → build → works alone
→ user validates via runbook → next). Measured Orange facts survived in
`poc/README.md` — knowledge is cheap to keep; unvalidated code is not.

## 2026-08-14/15 — Orange Network Playground (live, measured)

Full dated facts live in `poc/README.md` (kept as evidence through the
rollback). Headlines: two NON-interchangeable token endpoints (CAMARA vs
Admin); sim-swap `/check` `maxAge` is in HOURS (cap 2400 ≈ 100 days,
proven with a discriminating 20-day backstory); `403 FORBIDDEN` means
UNKNOWN NUMBER, not bad auth; built-in numbers `200/201`-echo Admin writes
while IGNORING them — only a READ after the write proves persistence
(READ-verify is load-bearing); `DELETE` returns `204` with an empty
non-JSON body.
