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
