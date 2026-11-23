# CAMARA v3 spec — attested windowed disclosure on Sync26

> **Status: working spec, NOT filed.** Opened 2026-11-23 after the
> Commonalities codeowner's review of camaraproject/Commonalities#705
> (record: `camara/v2/docs/commonalities-705-comment-received-2026-11-23.md`).
> This is the permanent spec for CAMARA v3; `docs/product/prd.md` stays the
> contract and links here. `camara/v2/` is frozen as the record of the #705
> round. CAMARA-facing records and filing text for v3 go in `camara/v3/` as
> they arrive. Built on the CAMARA Sync26 releases, read on 2026-11-23 (§2).
> Every API claim below is pinned to a release tag and a line in that tag's
> YAML. Re-verify before any filing.

## 1. The problem

CAMARA predicate APIs already answer questions about a line with yes or no.
That answer is protected by TLS only. It counts for the direct caller, at
the moment of the call. A party that did not make the call cannot check it.
An auditor cannot check it later without calling the operator again.

Contracts between operators and aggregators already govern how the parties
to those contracts behave. This proposal does not replace them. It adds
something for a party outside those contracts.

## 2. What CAMARA already does (Sync26)

The Sync26 releases moved toward the principle of this proposal: answer the
question asked, refuse what the operator does not allow, and do not return
the raw value. This proposal builds on that work and does not claim it as
new.

| API (tag, version) | What it already does | Where |
|---|---|---|
| Tenure (r3.4, v0.3.0) | The operator sets a regulatory threshold date R, "not part of the API request". A `tenureDate` before R, or in the future, gets `400 OUT_OF_RANGE`. If the subscription started before R, the answer is `true` for any date from R onwards, so the start date is not disclosed. A decision table states every case. | `kyc-tenure.yaml` lines 27-52 |
| kyc-age-verification (r2.3, v0.3.0) | A yes/no on a requester threshold (`ageCheck`: true / false / not_available). An `ageThreshold` outside "the narrower range or set of values agreed during onboarding due to local regulations" gets `400 OUT_OF_RANGE`. | `kyc-age-verification.yaml` lines 57, 244-246 |
| SimSwap (r4.3, v2.2.0) | `/check` answers `swapped` (boolean) for `maxAge` in hours, 1 to 2400. An operator may enforce a shorter limit and answers `400 OUT_OF_RANGE` with a message. `/check` has a dedicated `BadRequestWithRange400`. | `sim-swap.yaml` lines 39, 265-272, 544 |
| DeviceSwap (r4.3, v1.1.0) | Same shape as SimSwap `/check`, with `BadRequestWithRange400`. | `device-swap.yaml` lines 233, 494 |
| NumberVerification (r4.2, v2.1.1) | `/verify` answers yes/no. `GET /device-phone-number` takes no request body and derives the line from the 3-legged token. Access tokens MUST be single use "to prevent replay attacks", MUST NOT be refreshed, and MUST NOT live longer than 300 seconds. | `number-verification.yaml` lines 30-34 |
| kyc-match (r2.3, v1.0.0) | Per-field match results: true / false / not_available. A score (0-99) only when a field is false. No requester threshold. | `kyc-match.yaml` |
| SimSwapTimeFrame (Sandbox, no release) | Scope: a SIM-swap age band, "bounded disclosure compared with an exact SIM swap date". Moved out of SimSwap by the TSC on 2026-09-17. No API definition file yet (read 2026-11-23). | repository README |

So these are not new in this proposal:
- an operator-set limit that is refused loudly with `400 OUT_OF_RANGE`;
- a yes/no answer instead of the raw value;
- "not_available" as a third answer;
- replay protection on the access token.

## 3. Where it stopped

A search of all six Sync26 definition files above for "JWS", "signature",
"nonce" and "attest" found no match (2026-11-23). Four things are missing:

1. **The answer is not signed.** No response carries a signature, so only
   the direct caller can rely on it, and only at the time of the call.
2. **The operator's limits are not published.** They exist as prose
   ("may enforce") or as values "agreed during onboarding". A requester
   cannot read them before it calls, and a third party cannot check which
   limit applied.
3. **Nothing makes a limit tighten only.** Inside the allowed range, a
   requester may ask any value. When an answer passes from one party to the
   next, nothing stops a later party from asking a looser question than
   the one before it.
4. **Open values are still raw.** SimSwap `/retrieve-date` returns the
   exact date. The planned age band (SimSwapTimeFrame) is the only step
   toward a range, and it has no definition yet.

## 4. Proposal

### 4.1 A signed answer (fills gap 1)

The operator signs the existing answer. The answer itself does not change.

- The request gets one optional field, `nonce`, chosen by the requester.
- The response gets one field, `attestation`: a JWS (RFC 7515) whose payload
  carries the question asked (API, threshold), the answer, the requester's
  `nonce`, the issue time and an expiry (`exp`).
- The verifier finds the operator's key through a published JWKS.
- The answer stays yes/no. The attestation never carries the subscriber's
  raw value (no swap date, no subscription date, no location). It repeats
  only the requester's own question (for example `maxAge` or `tenureDate`),
  which the requester already knows.
- A signed response carries only the answer field and `attestation`.
  Other fields of today's response (for example Tenure's `contractType`)
  are left out, so nothing unsigned travels beside the signature. A request
  without `nonce` gets today's response, unchanged.
- A `nonce` that is present but is not a non-empty string (for example
  `null` or `""`) is refused, never treated as absent.
- If a response is also encrypted for an intermediary, it is signed first
  and then encrypted, so the requester still verifies the operator.

This is the response-side counterpart of the request-side DPoP claims
(`camara:bh`, `camara:qh`) in the CAMARA Security and Interoperability
Profile. It complements NumberVerification's single-use token: the token
rule protects the call; the nonce protects the answer.

Built and tested as V3-M1 (prd §4.4).

### 4.2 A published menu (fills gap 2)

The operator publishes the limits it already applies, in a machine-readable
form: for each API, the allowed values or range (for example Tenure's R,
age-verification's agreed set, SimSwap's local `maxAge` limit). An
off-menu request keeps today's behaviour: `400 OUT_OF_RANGE`, with
`BadRequestWithRange400` where the API has it. It is refused, never
rounded. The signed answer names the menu entry it was answered against.

Built and tested as V3-M2 (prd §4.4).

### 4.3 Tighten only (fills gap 3)

A party that passes an answer on may ask only the same or a stricter
question than the one it received. It never asks a looser one. The
signed question in §4.1 makes this checkable: the next party compares
the threshold in the signature with the one it needs. Widening is a new,
separate request, never a default.

Built and tested as V3-M3 (prd §4.4).

### 4.4 A range instead of a raw value (fills gap 4)

For open values, the operator answers with a range from its published menu
instead of the point value. The age band in SimSwapTimeFrame is the first
case. The author proposes to contribute to that repository rather than
define a second band here.

Built and tested as V3-M6, after SimSwapTimeFrame publishes a definition (prd §4.4).

### 4.5 First case: Tenure and SimSwap, signed

The first case needs no new API and no change to any answer:

- Tenure `/check-tenure` (`tenureDateCheck`) and SimSwap `/check`
  (`swapped`), each with §4.1's `nonce` and `attestation`.
- One use: a service that deals with an AI agent can check, later and
  without calling the operator, that an established line with no recent
  SIM swap stood behind the agent. This is a cost signal. It does not say
  who the person is, and it does not make the line unique.

Built as the V3-M4 demo on a mock, then V3-M5 on Orange Playground if it exposes both APIs (prd §4.4).

## 5. Route

- **Response signing is a Governance/TSC decision** (Commonalities codeowner,
  2026-11-23). §4.1 goes there first, with §4.5 as the concrete example.
  It is not presented as a way around that decision.
- **Commonalities guidance follows** the Governance/TSC direction: §4.2 and
  §4.3 as a design-guide pattern.
- **Ranges go to SimSwapTimeFrame** (§4.4), as a contribution to that
  Sandbox repository.
- **Not a new sub-project** (APIBacklog codeowner, 2026-08-31).
  APIBacklog PR #331 stays open until #705 has an outcome.

## 6. What this does not claim

- It is not zero-knowledge. The privacy comes from disclosing one bit.
- An aggregator in the path can still read the identifier and the answer.
  Hiding them (a blind hub) is a separate, later proposal.
- The operator still keeps its own query log.
- A SIM is not a person. Tenure and SIM-swap age make many fake lines
  costly; they do not prove uniqueness or identity.
- Number portability (MNP) can reset naive tenure.
- No aggregator operator has reviewed this design (TSC point, 2026-09-03).

## 7. Open questions

1. Where signing lives: a Commonalities guideline, or the Security and
   Interoperability Profile for the algorithm set, JWKS discovery and the
   replay window.
2. The menu format and where it is published.
3. Whether `nonce` is required or optional, and the maximum `exp`.
4. How the SimSwapTimeFrame band (§4.4) maps onto a published menu.

## 8. References (read 2026-11-23)

- camaraproject/Tenure r3.4, `code/API_definitions/kyc-tenure.yaml`
- camaraproject/KnowYourCustomerAgeVerification r2.3, `kyc-age-verification.yaml`
- camaraproject/SimSwap r4.3, `sim-swap.yaml`
- camaraproject/DeviceSwap r4.3, `device-swap.yaml`
- camaraproject/NumberVerification r4.2, `number-verification.yaml`
- camaraproject/KnowYourCustomerMatch r2.3, `kyc-match.yaml`
- camaraproject/SimSwapTimeFrame, README (no release)
- camaraproject/Commonalities#705 and APIBacklog PR #331 threads
- RFC 7515 (JWS), RFC 9449 (DPoP)
