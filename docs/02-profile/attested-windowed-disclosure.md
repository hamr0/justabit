# Attested Windowed Disclosure — a horizontal profile for network APIs

**Target home:** CAMARA Commonalities (design guideline) + ICM (consent/auth hooks)
**Status:** draft 0.1 — pre-submission
**Applies to:** any API answering questions about a subscriber/device (sim-swap,
number-verification, device-roaming-status, location-verification, kyc-*, …)

## 1. Definitions

- **Window** — the disclosure width of a response. The narrowest window that
  answers anything at all is one bit. (Vocabulary from zkagent's "attested
  windowed disclosure".)
- **Predicate** — a question with a boolean answer evaluated by the operator
  over facts it already holds ("swapAge ≥ 90d", "device in FR", "tenure ≥ 2y").
- **Floor** — the minimum predicate set a requester demands. Floors are
  **monotone**: they may be tightened by any party downstream, never loosened.
- **Nonce** — requester-supplied freshness value echoed inside the signed response.
- **Validity** — the response's lifetime; bounded by the query's duration
  where applicable, always short.

## 2. Normative rules (profile mode)

An API operation conforming to this profile:

1. **MUST** return only the predicate result (boolean) or a declared band —
   never the underlying raw value (timestamp, country, number, address).
2. **MUST** echo the requester's nonce inside the signed response payload and
   **MUST** include an expiry; verifiers **MUST** reject replayed or expired
   responses.
3. **MUST** sign responses with a key resolvable through the operator trust
   directory (per-PLMN public keys).
4. **MUST NOT** carry a subscriber identifier in the request where it is
   derivable from the access token (generalizes the existing 3-legged rule:
   `phoneNumber` "MUST NOT be included").
5. **MUST** treat floors as monotone: an intermediary or delegate may tighten,
   never widen; a request below the operator's published floor is rejected,
   not silently answered.
6. **MUST** be end-to-end encrypted between requester and operator when carried
   through an aggregator; the aggregator handles metering envelopes only
   (count, route, bill) — it **MUST NOT** be able to read identifiers,
   predicates, or answers. (The A2P lesson: middle layers that can read,
   eventually monetize.)
7. **SHOULD** offer banded responses only as a transitional step from raw
   values (`/retrieve-age-band` pattern); bands are a wider window than a
   predicate and need justification.
8. Widening the window beyond one bit **MUST** be an explicit, distinct
   operation the subscriber-side consent flow can see — never a parameter
   default.

## 3. Adoption checklist for existing APIs

| API | Profile-mode change |
|---|---|
| sim-swap | `/check` conforms with nonce+expiry added; `/retrieve-date` excluded from profile mode |
| number-verification | `/verify` conforms with nonce+expiry; `/device-phone-number` excluded |
| device-roaming-status | replace country retrieval with country/region predicates ("in FR?", "in EU?") |
| location-verification | already predicate-shaped; add nonce+expiry, drop retrieval variant |
| kyc | `kyc-age-verification` conforms; `kyc-match` conforms (scores are bands); `kyc-fill-in` excluded |

## 4. Agent-grade floor (reference profile)

Consumer-agent floor (only tightenable):

```
simType  = voice+data      # excludes data-only IoT/M2M SIMs
tenure   ≥ 2 years
swapAge  ≥ 90 days
class    = postpaid        # optional tightening
```

Machine-agent profile (fleets, vehicles — no human document exists): embraces
M2M SIMs; predicates over fleet contract tenure, account standing, mobility
organicity. The two profiles are distinct and must not be conflated.

Honest limit: floors price identity resets (economic scarcity); they do not
create uniqueness. "One accountable human" requires a document-rooted principal
layer above this profile.

## 5. Residuals, stated honestly

- Mode A retains the operator-side query log (requester asked about subscriber
  S). Acceptable where the requester already holds its customer's number;
  removed only by Mode B (holder presentment).
- The operator always knows it attested fact T about subscriber S at time t —
  never to whom it was ultimately presented (Mode B) or beyond the requester
  (Mode A).
- The trust directory is the single centralization point; governance belongs
  with existing GSMA key-distribution rails (RAEX/IR.21-shaped).
