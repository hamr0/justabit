# ietf/v2/poc — actionClass floor axis spike

A SPIKE for `draft-hamr-oauth-agent-delegation` -01, not a conformance
harness (see the repo's standing no-go on shipping conformance harnesses —
this ships as prose + test vectors in the draft, not this code).

Copied from `ietf/v1/poc/` on 2026-09-01 when the -01 round opened
(`ietf/v1/poc/` is now a frozen copy behind the -00 record and is never
edited); only the run-path comment in `m7-check.mjs` and this README's
own text differ from that copy (2026-09-01).

`spike-a/` is the catalogue survey (spike A): a read-only measurement of
whether an `actionClass` method-default hides consequential operations
across the CAMARA API catalogue, run 2026-09-01 and moved into the repo by
user decision (its `specs/` directory of fetched YAML copies was left out,
being reproducible from the SHA column in `spike-a/operations.csv`). It is
data, not code, and is distinct from the code spike (B) below, which is
the `admit`/`classify` gate itself.

## Run

    node ietf/v2/poc/m7-check.mjs
    node ietf/v2/poc/m3-check.mjs   # the copied M3 gate, unchanged

`m3-floor.mjs`, `m3-check.mjs`, `check-harness.mjs`, `m1-jws.mjs` are
byte-identical copies of `camara/v2/poc/`'s. `m1-attestation.mjs` was also
copied — undeclared in the original five-line spec, but a hard runtime
dependency of `m1-jws.mjs` (`hasDuplicateTopLevelKey`); flagged for review.

## The five spec lines

1. Copy the four (in practice five) named files unchanged; build new code beside them.
2. Two ordered enum axes (`actionClass`: r<w<x; `classSource`: declared<method) plus one monotone-down integer axis (`writeBudget`).
3. `classify(method, path, menu, classSource, targetOrigin)`: RFC 9110 method default, or the owner's signed menu when `classSource: declared`, the signature verifies, and (2026-09-01 addition) the menu's `iss` matches `targetOrigin` octet-for-octet — never `max(method, declared)`.
4. `admit(link, request, state)`: stateless actionClass gate, stateful writeBudget ledger keyed by a chain id the verifier itself derives (2026-09-01 addition: `deriveChainId`, the SHA-256 digest of `request.rootSignature` — L(0)'s wire signature bytes — never a caller-supplied field); `r` never spends.
5. Menu = a JWS over `{ iss, menu: { "METHOD path-template": class } }`, verified against the owner's key only; path-template keys (2026-09-01 addition) match per the draft's deterministic segment rule, not exact string equality.

## What this does NOT prove

Not adversarially reviewed by a second round. No live network calls, no real
delegation-chain wire format, no interop with any other implementation. The
original mutation table (see the build report) killed 5 targeted guards; it
did not attempt a broader mutation sweep. The 2026-09-01 round below adds 5
more targeted mutations (one per changed/added case, cases 23 and 27 sharing
one), each confirmed red under the mutation and green on restore; it is
still not a broader sweep.

### 2026-09-01 — cases 22-24 brought up to -01 text; two cases added

The three assumptions cases 22-24 used to pin (chainId taken from the
request, exact-string menu keys, no menu-to-resource origin binding) are
now resolved in both the -01 draft text (`action-class` and `write-budget`
in `ietf/v2/docs/draft-hamr-oauth-agent-delegation-01.xml`) and this code,
which the draft text governs:

- **Case 22 — chain identifier is verifier-derived.** `admit()` no longer
  reads any `chainId`-shaped field from `request`; the writeBudget ledger is
  keyed by `deriveChainId(request.rootSignature)`, the SHA-256 digest of
  L(0)'s wire signature bytes. A request that also carries an arbitrary
  caller-supplied `chainId` field is admitted or refused exactly as if that
  field were absent — proven by pinning it present in case 22 and observing
  no effect.
- **Case 23 — menu keys are path templates.** `POST /calls/{callId}` now
  matches a concrete request path `/calls/123` per the draft's
  deterministic segment rule (same segment count; `{param}` matches one
  non-empty segment; more literal segments wins; an equal-literal tie is a
  miss, fail-closed to the method default — case 26 pins the tie
  behaviour, case 27 pins that a literal `__proto__` menu key cannot crash
  or bypass the matcher).
- **Case 24 — the menu is bound to the resource origin.** A menu's `iss`
  must equal the request target's RFC 6454 origin octet-for-octet; on any
  mismatch the menu fails exactly as an invalid signature would, and the
  method default applies (the same shape as the draft's appendix vector V9).

Case 25 adds the appendix's V10 step sequence (writeBudget 2: admit, admit,
refuse) as its own case, distinct from case 11's writeBudget-1 sequence.
The suite grew from 24 to 27 cases; all 27 pass, `node
ietf/v2/poc/m3-check.mjs` (untouched) still passes its 26.

### 2026-09-02 — branch-review round: one defect, one conformance gap, one test-quality fix; 27 -> 34 cases

A `/branch-review` found three items, independently reproduced, all fixed:

- **`deriveChainId` collision on malformed input.** `Buffer.from(s,
  'base64url')` does not throw on a character outside the base64url
  alphabet — it silently strips it and decodes what's left, so
  `deriveChainId('abcd')`, `deriveChainId('ab!!cd')`, and
  `deriveChainId('ab cd')` all produced the identical digest. Fixed by
  validating a string `rootSignature` against the strict base64url
  alphabet (`A-Za-z0-9_-`) before any decode; base64url is treated as
  UNPADDED here (matching `m1-jws.mjs`'s own `toString('base64url')`
  output), so a `=` character is also rejected. Byte inputs
  (Buffer/Uint8Array) are unaffected — they never went through the
  charset-dependent path. Cases 29-30 pin non-collision and rejection;
  mutation-confirmed (see table below).
- **Link-to-link omitted-axis rule was not implemented.**
  `checkActionFloor` only ever applied the link-to-published-floor case of
  the draft's Omitted-axis rule (inherit the tightest default), never the
  link-to-link case: where the PARENT link constrains classSource or
  writeBudget and the CHILD omits it, that omission is
  non-relaxation-by-omission and the chain MUST be rejected, per
  attenuation rule 2. `checkActionFloor` now rejects that shape for both
  axes (actionClass needs no such check — the draft gives it no omission
  semantics at all, and `validateLink` already hard-rejects a child that
  omits it). Cases 31-32 pin the new rejection (one per axis); cases 33-34
  pin that the *other* direction — neither link constrains the axis — is
  still inheritance, not rejection, so the fix did not regress it (cases
  16-17 already covered this shape and still pass). No existing case's
  expected result changed.
- **Case 27's comment overstated what it pins.** Replacing
  `matchOperationKey`'s `Object.keys(menu)` with `for (const key in menu)`
  left the suite green at 27/27 — case 27 proves a literal `"__proto__"`
  *own* key doesn't crash or bypass matching (still true and useful) but
  never exercised the *enumeration guard* (own keys only, no prototype
  walk) its comment claimed. Fixed by adding case 28: it temporarily
  defines an enumerable property directly on `Object.prototype` (removed
  in a `finally`, so no state leaks across cases either way) and confirms
  `classify()` does not treat it as a menu match. Case 27's comment is
  narrowed to what it actually pins, with a forward pointer to case 28.

The suite grew from 27 to 34 cases; all 34 pass. `node
ietf/v2/poc/m3-check.mjs` (untouched) still passes its 26 unchanged.

Mutation table (revert guard -> confirm red -> restore -> confirm green;
each restore diffed byte-identical to the fixed file):

| Mutation | Mutant exit | Cases red | Restored exit |
|---|---|---|---|
| Remove the base64url charset check in `deriveChainId` | 1 | 29, 30 (both digests collided with `deriveChainId('abcd')`, confirming the reproduced defect) | 0 |
| Remove both link-to-link omitted-axis checks in `checkActionFloor` | 1 | 31, 32 | 0 |
| `matchOperationKey`: `Object.keys(menu)` -> `for (const key in menu)` | 1 | 28 (Object.prototype still confirmed clean afterward) | 0 |

### 2026-09-02 — second branch-review round: one CRITICAL still-collides defect, two untested WARNINGs; 34 -> 40 cases

A second `/branch-review` found the previous round's `deriveChainId` fix
incomplete, plus two guards in this module with no case defending them at
all — all three independently reproduced before any fix:

- **CRITICAL — `deriveChainId` still collided, via decode truncation.** The
  base64url charset check (previous round) closes out-of-alphabet
  collisions only. `Buffer.from(s, 'base64url')` also silently DISCARDS the
  low-order bits of a final partial group when `s.length` mod 4 is 2 or 3
  (and drops the whole trailing character when it's 1) instead of
  rejecting them, so in-alphabet strings of equal length can still collide:
  `deriveChainId('AA') === deriveChainId('AB') === deriveChainId('AC') ===
  deriveChainId('AD')`, all four decoding to `<Buffer 00>`. Fixed by adding
  a canonical round-trip check after decode: the decoded bytes are
  re-encoded with the same `.toString('base64url')` convention, and the
  input is rejected unless that re-encoding reproduces the original string
  exactly — only the canonical unpadded encoding of a byte string
  round-trips to itself, so this collapses "many strings decode to the same
  bytes" down to exactly one accepted spelling per byte string. It also
  rejects every length-mod-4-equals-1 string as a side effect (no such
  string ever round-trips), so no separate length check was added. Byte
  inputs (Buffer/Uint8Array) are unaffected — verified a zero-length Buffer
  and a zero-length Uint8Array are both still rejected (case coverage:
  cases 29-30, unchanged, still exercise the charset guard; new cases 35-36
  pin the round-trip defect itself and the length-mod-4-equals-1 case).
- **WARNING — the `hasOwn` guard (line ~161) had no case defending it.**
  Mutating it to a truthiness check (`!!obj[key]`) or to `key in obj` left
  the (then-34-case) suite green at exit 0. Fixed with three new cases: 38
  pins the falsy-adjacent value `writeBudget: 0` (a legitimate constraint
  that reads false under `!!`); 39 and 40 pollute `Object.prototype` with
  the axis name and confirm a link that genuinely omits the axis is still
  rejected against a parent that constrains it as its own property —
  `isPlainObject` forces every accepted link to share `Object.prototype` as
  its prototype, so a construction where BOTH links merely omit a polluted
  axis is symmetric under both `hasOwnProperty` and `in` and cannot
  distinguish them; the parent-owns / child-truly-omits shape (mirroring
  cases 31/32) does distinguish them, since `in` cannot tell "child's own"
  from "inherited via the polluted prototype" the way `hasOwnProperty` can.
  `Object.prototype` is restored in a `finally` in both cases (case 28's
  pattern) and confirmed clean afterward regardless of pass or fail. No
  classSource equivalent of case 38 was added: `classSource`'s legal values
  (`'declared'`/`'method'`) are both non-empty strings, always truthy under
  `!!`, so no falsy-adjacent value exists there for a truthiness mutant to
  exploit — a case built on that axis could not fail.
- **WARNING — the unpadded-base64url contract had no case defending it.**
  The module's comment says a `=` character is invalid input, but no case
  supplied a padded string; mutating the alphabet regex to also accept `=`
  left the suite green. Case 37 supplies a padded input (`'AA=='`) and
  asserts rejection; it defends the contract at both guards at once — even
  under the regex-accepts-`=` mutant, `'AA=='` fails the canonical
  round-trip check too (it decodes to the same byte as `'AA'`, and
  re-encoding gives `'AA'`, not `'AA=='`).

**Fixtures changed, and why.** The canonical round-trip rule is *stricter*
than the previous charset-only check, so every existing case's
`rootSignature` fixture had to be re-checked against it. Six were not
canonical unpadded base64url and were replaced with mnemonic canonical
strings (`Buffer.from('caseN-root', 'utf8').toString('base64url')`, e.g.
`'c1sig'` (5 chars, decodes+truncates to 3 bytes, does not round-trip) ->
`'Y2FzZTEtcm9vdA'`): cases 1 (`c1sig`), 2 (`c2sig`), 3 (`c3sig`), 11
(`c5sig`), 22 (`c22root`), 25 (`c25root`). Every other existing
`rootSignature` fixture (`c13sig`, `c14sig`, `c16sig`, `c17sig`, `c23sig`,
`c24sig`, `c26sig`, `c27sig`, and cases 29-30's `'abcd'` / `'ab!!cd'` /
`'ab cd'`) was already canonical or already deliberately invalid and needed
no change. No case's expected PASS/FAIL result changed — only the input
string each case's `admit()` call was given, and (for case 11, whose
expected reason string embeds a live `deriveChainId(...)` call) the string
passed to that same call, kept in sync with the fixture.

**A tautology found and reported, not hidden.** Two of the five required
mutations no longer distinguish correct code from mutant once the
round-trip check is in place: removing the charset guard entirely, or
widening the regex to also accept `=`, both still leave every input this
suite exercises rejected — the round-trip check independently catches every
out-of-alphabet or padded string the charset guard used to catch alone,
because no such string can ever be the canonical re-encoding of its own
decoded bytes. The suite stays green under both mutations; see the table
below.

The suite grew from 34 to 40 cases; all 40 pass. `node
ietf/v2/poc/m3-check.mjs` (untouched, not edited this round either) still
passes its 26 unchanged.

Mutation table (revert guard -> confirm red -> restore -> confirm green;
each restore diffed byte-identical to the fixed file):

| # | Mutation | Mutant exit | Cases red | Restored exit |
|---|---|---|---|---|
| 1 | Remove the base64url charset check entirely | 0 | **none — tautology.** The canonical round-trip check independently rejects every out-of-alphabet string this suite exercises (it can never be its own canonical re-encoding), so this guard is currently untestable in isolation now that the round-trip check exists. | 0 |
| 2 | Widen the charset regex to also accept `=` | 0 | **none — tautology**, same reason as #1: a padded string still fails the round-trip check. | 0 |
| 3 | Remove the canonical round-trip check | 1 | 35 | 0 |
| 4 | `hasOwn`: `Object.prototype.hasOwnProperty.call` -> `!!obj[key]` (truthiness) | 1 | 38, 39, 40 | 0 |
| 5 | `hasOwn`: `Object.prototype.hasOwnProperty.call` -> `key in obj` | 1 | 39, 40 | 0 |
