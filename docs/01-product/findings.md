# Findings log

Dated, append-only. What experiments actually showed — including what did
NOT work. Complements `prd.md` (which records decisions); this records the
evidence and the dead ends, so nothing gets re-tried or re-argued from
memory. A finding here is something that was RUN and OBSERVED, not reasoned.

---

## 2026-08-15 — M3 floor gate: spike traps, build, mutation proofs (user-validated 14/14)

Spike (throwaway, scratchpad) attacked the toughest assumption — "no silent
widening path exists" — and confirmed six JS traps a naive gate would ship:

1. **Lexicographic string compare WIDENS silently**: `'P100D' < 'P90D'` is
   true as strings — a naive `requested >= published` compare rejects
   tighter requests and (mirrored) admits looser ones. Parse, never compare
   strings.
2. **`parseInt('3M') === 3`** — a lenient parser reads months as days.
3. **`Number(null) === 0`, `Number('') === 0`** — coercion turns a garbage
   PUBLISHED floor into "0 days", admitting EVERY request. Hence: broken
   published config THROWS (operator's own fault, loud); wire input rejects.
4. Strict grammar `^P(\d+)(D|Y)$` kills `P3M`/`P90d`/`90D`/`PT90H`/
   `P-90D`/compound forms/non-strings in one regex.
5. Precision at the 2^53 edge cannot flip an ordering (monotone).
6. Enum compare is exact-match, case-sensitive.

Build: `poc/m3-floor.mjs` (pure function, no crypto) + `poc/m3-check.mjs`
(14 cases, negatives first). USER ran the check personally: 14/14 exit 0.

Mutation proofs (module restored byte-identical from working-copy backup
after each): (A) below-floor rejection disabled → cases 1+2 red; (B)
unknown axes ignored → cases 4+5 red; (C) numeric compare replaced with
string compare → cases 2, 9, 11 red. Mutant C's FIRST run died as a stack
trace with no RESULT line — the check's own `v.effective.x` derefs were
unguarded, the exact "dead process instead of a FAIL" defect M2's review
caught — fixed with `?.` so a regressed module prints clean FAIL lines to
a RESULT tally.

## 2026-08-15 — The two v0.0.3 security Mediums closed (duplicate keys + key pinning)

Closed same-day on user decision ("fix both now"), not parked to M3.

1. **Duplicate-key equivocation — RUN and OBSERVED, then fixed.** A signed
   payload carrying `"result":true … "result":false` passed the full M1
   verifier (V8 last-wins; the closed-set check can't see it — Object.keys
   shows one `result`). With the new byte-level scan removed (mutation),
   both new check cases print `expected REJECT, got ACCEPT — got 'ok'`;
   with it, 19/19. The scan compares keys AFTER JSON escape decoding —
   case 18 proves `\u0072esult` cannot impersonate a fresh key. Normative:
   rule 2 sentence added (README copy synced, spec YAML description synced).
2. **Key pinning — text-only today.** Rule 3 now requires the verifier to
   pin the expected operator key BEFORE verification; unsigned `iss` is a
   lookup hint only. The reference verifier already takes a caller-pinned
   key, so no code change exists to test; the enforceable surface arrives
   with the trust directory at M6.

Regression: m1-check 19/19 exit 0 (2 new cases), m2-check 10/10 exit 0
(E2E composes through the patched verifier), spec YAML parses with zero
null-valued keys, mutated module restored byte-identical from backup.

## 2026-08-15 — Whole-branch release gates (code-review 8/8 fixed; security + diff-review)

First review of the branch as a unit (each module had only per-build
reviews). `/code-review medium`: 8 confirmed findings, all fixed and re-run
green (m1 17/17 byte-identical output, m2 10/10) — headline items: README
advertised a `demo.mjs` that doesn't exist yet (M6 target); two docs still
said ECDH+AES-GCM after the RSA-OAEP decision; the spec sketch and the
reference verifier were mutually unimplementable (iat/iss inside claims,
ISO-string exp); 6 of 8 hub-blind key attempts crashed on key-type before
any crypto (attack theater — reduced to the decryption-capable set);
`.gitignore`'s `.*/` silently ignored `.github/`. **Supersedes M2 finding 6
below:** the check-harness duplication WAS extracted
(`poc/check-harness.mjs`) once the whole-branch view made it a third-copy
risk; proven behavior-preserving by byte-identical m1 output.

Release-gate round on top (fresh agents, read-only, mutation-proving):
diff-review found the spec's unquoted inline YAML descriptions silently
truncating (the epoch-ms `exp` detail — the parity fix's own point — was
being dropped by any YAML parser), and that case 8's reason string had
become derived-from-verdict (tautology) rather than observed — both fixed,
observation restored. Security: nothing Critical/High; two Mediums are
normative-text gaps (duplicate-JSON-key ambiguity under sign-what-you-ship;
no rule pinning WHICH operator key a verifier expects) — WG-facing, held
as open decisions for the submission round, not merge blockers.

M2 built (`poc/m2-envelope.mjs` seal/open + `poc/m2-check.mjs`, 10 cases,
10/10 exit 0; M1 regression-checked at 17/17). The review's orchestrator
died on a session limit, so the finders' raw candidates were validated
manually before fixing (a dead reviewer's silence is never a clean bill).

1. **seal()'s capacity guard was hard-coded to the RSA-4096 value (446).**
   Proven live: a 300-byte payload sealed to an RSA-2048 key passed the
   guard and died inside OpenSSL as raw `data too large for key size` —
   the exact unhelpful failure the guard exists to replace; a larger key
   would falsely reject legal payloads. Fixed: capacity DERIVED from the
   recipient key's modulus (`bits/8 − 66`); non-RSA/PEM-string recipients
   get a clear "must be an RSA KeyObject" throw. Mutation-proven: restoring
   the hard-coded guard turns the new RSA-2048 case red. Lesson: a
   constant that is a property of a KEY must be derived from the key.
2. **A hardcoded `ok: true` extra assertion** (TAMPER case) printed as if
   verified while asserting nothing. Dropped — a decorative always-true
   assertion is worse than none.
3. **HUB BLIND redundancy/mislabeling** — the extra duplicated the verdict
   condition, and a catastrophic recovery would have printed as a
   taxonomy note ('mixed reasons') instead of the actual event. Fixed:
   reason now says 'recovered' when the hub reads plaintext.
4. **Triple hand-synced copies of one predicate** (SIZE CONSTANT) — now
   computed once.
5. **Unguarded parses after open() in the E2E** — a regression would have
   died as a stack trace with NO RESULT line instead of a FAIL. Fixed with
   ok-gated steps; negative control run both ways (gated → clean
   `RESULT: 9/10` exit 1; ungated shape → dead process, no RESULT).
6. **Documented, NOT fixed: the check-harness duplication** between
   m1-check and m2-check (~20 lines). Deliberate: each module's check must
   run standalone, and refactoring would touch the already-user-validated
   M1 files. Accepted drift risk, revisit only if a third copy appears
   with an actual harness bug to sync.

Post-build honesty audit (user challenge, answered item-by-item):
- **The hub is a ROLE in the check, not code** — the routing/metering hub
  actor is M6's to build; M2 delivered the envelope primitives + the
  blindness proof.
- **Requests are encrypted but NOT authenticated** — the response carries
  M1's signature, the request carries none; nothing cryptographically ties
  a request to an RP, and no ladder module owns sender authentication yet.
  OPEN ITEM — assign at M6 spec time (options: RP signature over the
  request, or accept hub-level API auth as the demo answer, stated).
- **Envelope-level replay**: a captured request ciphertext re-sent to the
  operator burns a query (billing nuisance); the RP still rejects the
  stale answer via nonce. Stateless, same story as M1 — now stated.
- **No forward secrecy**: a stolen private key decrypts recorded past
  traffic; subsumed under "demo transport, production = TLS/HPKE" but
  named here explicitly.
- **512 B constancy assumes uniform RSA-4096** (pinned by
  generateEnvelopeKeys); mixed key sizes would fingerprint key size.
- Validation split, stated: green paths re-run by the orchestrator
  directly (exit codes); mutation proofs and the live RSA-2048 probe
  validated from agents' verbatim captured output, not re-executed.

## 2026-08-15 — M2 throwaway spike (blind envelope, scratchpad)

RSA-4096 OAEP-SHA256 (`crypto.publicEncrypt`/`privateDecrypt`, one vetted
stdlib primitive, zero deps, no hand-composed crypto), keys exchanged via
the trust directory — never inside payloads. 8 checks, exit 0.

- **Fit is real but not roomy.** OAEP capacity is 446 bytes. Measured:
  request 148 B (33% of cap), response 270 B (60% of cap, 176 B headroom).
  Overflow control proved the cap genuinely refuses (966 B →
  `DATA_TOO_LARGE_FOR_KEY_SIZE`) — the fit tests could fail. **Constraint
  for later modules: one added claim field or a bigger payload (Mode B,
  multi-attestation) blows the envelope — that would require a vetted AEAD
  hybrid scheme as an explicit new decision, not glue.**
- **Hub blindness proven structurally, and falsifiably.** The hub tried
  all 3 directory public keys AND its own private key against both
  ciphertexts: 8 attempts, 0 recoveries, 0 plaintext substrings.
  Mutation-verified: handing the hub the true recipient's private key
  flips the blindness checks red. Positive control: operator read the
  request exactly; RP verified the M1 signature end-to-end.
- **Size side channel: does NOT exist at this layer.** All content
  variants (3 predicates, both result values, plaintexts 141–274 B)
  produced EXACTLY 512-byte ciphertexts — RSA is fixed-width, so the
  hub's byte-metering log records a constant. The rule-6 padding worry is
  answered for the demo envelope. **Honest remainder: message COUNT,
  TIMING, and the RP↔operator PAIRING stay visible to the hub — that is
  the real metadata surface, and the docs must say so.**
- **Tamper = reject, not crash**: one flipped ciphertext bit →
  `OAEP_DECODING_ERROR`, caught — the hub cannot mutate an in-flight
  answer undetected, on top of the Ed25519 signature underneath.
- Implementation note: `privateDecrypt` THROWS on every failure mode
  (wrong key, public key, tamper) — a real hub/recipient must catch
  per-attempt or die on its own probe.

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
