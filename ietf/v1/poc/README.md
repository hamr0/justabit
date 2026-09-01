# ietf/v1/poc — actionClass floor axis spike

A SPIKE for `draft-hamr-oauth-agent-delegation` -01, not a conformance
harness (see the repo's standing no-go on shipping conformance harnesses —
this ships as prose + test vectors in the draft, not this code).

## Run

    node ietf/v1/poc/m7-check.mjs
    node ietf/v1/poc/m3-check.mjs   # the copied M3 gate, unchanged

`m3-floor.mjs`, `m3-check.mjs`, `check-harness.mjs`, `m1-jws.mjs` are
byte-identical copies of `camara/v2/poc/`'s. `m1-attestation.mjs` was also
copied — undeclared in the original five-line spec, but a hard runtime
dependency of `m1-jws.mjs` (`hasDuplicateTopLevelKey`); flagged for review.

## The five spec lines

1. Copy the four (in practice five) named files unchanged; build new code beside them.
2. Two ordered enum axes (`actionClass`: r<w<x; `classSource`: declared<method) plus one monotone-down integer axis (`writeBudget`).
3. `classify(method, path, menu, classSource)`: RFC 9110 method default, or the owner's signed menu when `classSource: declared` and the signature verifies — never `max(method, declared)`.
4. `admit(link, request, state)`: stateless actionClass gate, stateful writeBudget ledger keyed by chain id; `r` never spends.
5. Menu = a JWS over `{ iss, menu: { "METHOD path": class } }`, verified against the owner's key only.

## What this does NOT prove

Not adversarially reviewed by a second round. No live network calls, no real
delegation-chain wire format, no interop with any other implementation. The
mutation table (see the build report) killed 5 targeted guards; it did not
attempt a broader mutation sweep.

### Three assumptions pinned by cases 22-24

- **Case 22 — chainId is caller-supplied.** A fresh `chainId` refills the
  writeBudget ledger. -01 must derive `chainId` from the signed chain (e.g. a
  digest of the root link's signature), never take it from the request.
- **Case 23 — menu keys are exact strings.** A path template
  (`POST /calls/{callId}`) does not match a concrete request path
  (`/calls/123`); the lookup misses and falls back to the method default.
  -01 needs OpenAPI-style path-template matching in the menu lookup.
- **Case 24 — the menu is not bound to the resource being called.** `iss` is
  checked for type only, never compared to the request's target origin.
  -01 must bind the menu to the resource origin (`iss` == the authority of
  the request target, or a per-origin key resolver).
