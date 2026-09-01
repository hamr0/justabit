> **Bookkeeping (v2, NOT filed).** Rewritten 2026-08-31 from the v1 text
> (`camara/v1/docs/camara-attested-windowed-disclosure.md`, filed as
> issue #330 / PR #331, frozen as filed). Source of the decisions behind
> this rewrite: APIBacklog codeowner feedback 2026-08-31
> (`camara/v1/docs/feedback-2026-08-31.md`) and the user decision recorded
> the same day in `docs/logs/findings.md`. Grounded against
> `camaraproject/APIBacklog` (Scope Enhancement template,
> `issue_enhancement_template.md`), `camaraproject/IdentityAndConsentManagement`
> (`CAMARA-Security-Interoperability.md`), `camaraproject/SimSwap`
> (`sim-swap.yaml`), and `camaraproject/Commonalities`
> (`CAMARA-API-Design-Guide.md`) on 2026-08-31 — see §References for exact
> paths and lines cited.

# Attested Responses — a Commonalities design guideline for CAMARA network APIs (attested windowed disclosure, v2)

**Author:** Amr Hassan, independent telecom consultant (10 yrs wholesale
roaming / signaling / SoR)
**Status:** Draft v2 — rescoped after WG feedback; not yet filed
**Date:** 2026-08-31
**Target:** CAMARA Commonalities, as an enhancement issue (route
confirmed 2026-08-31 by a Commonalities codeowner), guideline to live in
the CAMARA API Design Guide; first adoption example SimSwap `/check`
**Companion:** the agent/delegation side (holder presentment, trust
directory, agent-grade floor bundles) is out of scope for CAMARA and
proposed separately to the IETF OAuth Working Group
(`ietf/v1/docs/ietf-agent-delegation.md`); the two meet at the RFC 9421
header and neither depends on the other.

---

## v1 → v2: what changed and why (≤ 20 lines)

CAMARA APIBacklog codeowner feedback on PR #331 (2026-08-31,
`camara/v1/docs/feedback-2026-08-31.md`) made three points, all accepted:
(1) "horizontal profile" is not a valid sub-project type under the Project
Charter, and use case 2 (AI-agent holder presentment / trust directory) is
east-west VC infrastructure the Charter excludes; (2) the overlap with KYC
Age Verification and SimSwap age-band is functional, not inspirational —
both already return a predicate over an operator-held fact, the only delta
is the signing wrapper; (3) a signed-response layer belongs in
Commonalities, applied consistently catalog-wide, not in a new sub-project.

v2 therefore: drops use case 2 and the whole Mode B / agent-grade-floor /
trust-directory design (IETF-only now); drops the CarrierAttestation
new-case filing; renumbers the normative rules to the four-item delta the
catalog lacks; and files as a Commonalities Scope Enhancement, not a new
APIBacklog sub-project. Two visible corrections: v1's "no overlap" claim
missed the Tenure API (`/check-tenure`, TSC-approved 2024-05-16 — see
§Adoption checklist, `docs/logs/findings.md` 2026-08-31); and v1's rule 4
(MUST NOT carry a subscriber identifier where token-derivable) is REVERSED,
not renumbered — the spec now REQUIRES `phoneNumber`, per the 2026-08-24
finding that identifier-free 3-legged flows do not exist
(`docs/logs/findings.md`).

## 1. Problem statement

CAMARA APIs answering questions about a subscriber or device already
return a predicate on every axis this proposal cares about:

| API | Predicate endpoint | Response shape |
|---|---|---|
| SimSwap v2.1.0 | `POST /check` | boolean `swapped` |
| Tenure (Vodafone, TSC-approved 2024-05-16, r2.2, v0.2.0 — tag r3.2 carries v0.3.0-rc.1, a release candidate, not cited here) | `POST /check-tenure` | boolean `tenureDateCheck` (+ optional `contractType`) |
| KnowYourCustomerAgeVerification | `ageCheck` operation | string enum `'true' \| 'false' \| 'not_available'` |
| location-verification | `verify` | `TRUE \| FALSE \| PARTIAL` |

*(Verified 2026-08-31 against `camaraproject/SimSwap/code/API_definitions/sim-swap.yaml`,
main; Tenure and KYC Age Verification shapes per the 2026-08-14/re-verified
2026-08-24 baseline, `docs/logs/findings.md`.)*

Every one of these responses today is: **TLS-only** (trusted by the direct
caller, no further), **replayable** (nothing binds it to a specific
requester or moment), and **non-transferable** (a relying party's own
auditor cannot re-verify it without calling the operator again). The
boolean itself is not the gap — the catalog already answers in booleans.
The gap is the envelope around the boolean.

## 2. The ask

This document proposes exactly three additions (§2.1, §2.2, §2.4), as ONE
Commonalities Scope Enhancement, on top of the existing predicate
responses above — nothing else. A fourth item, the blind hub (§2.3), is
argued here but deliberately held for a separate companion filing
(decision below, §2.3) — it is not part of this ask.

### 2.1 Attested response

The existing boolean answer, signed by the operator as a JWS (RFC 7515),
bound to a requester-supplied nonce, with an expiry, verifiable by any
third party through a per-operator JWKS (RFC 7517). See §4 for the
SimSwap `/check` worked example.

### 2.2 Floor rule

The operator publishes a threshold menu (a floor); where an existing
request field already carries an ordered threshold, the requester may
only tighten it by choosing a value from that menu — nothing is added to
the request to carry the menu itself. Off-menu requests are refused
loudly, never rounded (see the `OFF_MENU_THRESHOLD` sketch in §4). Today
thresholds are free-form. The existing field, its unit, and its bound
vary per API — this is not one shape repeated catalog-wide:

| API | Threshold field | Type / unit | Bound |
|---|---|---|---|
| SimSwap `/check` (r3.3, v2.1.0) | `maxAge` | integer, **hours** | min 1, max 2400, default 240 — "Period in hours to be checked for SIM swap." |
| DeviceSwap `/check` (r3.2, v1.0.0) | `maxAge` | integer, **hours** | min 1, max 2400, default 240 — "Period in hours to be checked for device swap." |
| location-verification (r3.2, v3.0.0) | `Circle.radius` | number, **meters** | min 1, no maximum — "Expected accuracy for the verification, in meters from `center`." |
| DeviceStatus roaming / reachability (r2.2, v1.0.0) | *(none)* | — | no threshold field exists in the request (an optional `device` wrapper is the only body); the absence of a menu here is deliberate, not an oversight (see the roaming/reachability note below) |
| kyc-match (r2.2, v0.3.0) | *(none)* | — | no threshold field exists in the request — see §6, open item |

(All verified 2026-08-31 against each API's canonical `code/API_definitions/*.yaml`.)

**A same-named trap: location-verification's `maxAge` is a different field
in a different unit.** location-verification also has a field literally
named `maxAge`, but it is not the threshold above — it is cache
freshness: `type: integer`, **seconds**, no minimum/maximum/default,
described verbatim as "The maximum age (in seconds) for the location
known by the implementation, which is accepted for the verification.
Absence of `maxAge` means 'any age' and `maxAge=0` means a fresh
calculation." This profile does **not** use location-verification's
`maxAge` as its threshold field — `Circle.radius` is the threshold; the
two `maxAge` fields must never be conflated.

SimSwap `/check`'s `maxAge` accepts any integer hour 1–2400 (verified
against `sim-swap.yaml`, `CreateCheckSimSwap.maxAge`); Tenure's
`tenureDate` accepts any date. Floors are monotone: any party downstream
may tighten, never loosen; widening is a distinct, consent-visible
operation, never a default.

### 2.3 Blind hub (held for a companion filing — not part of this enhancement)

End-to-end encryption of the request and response through an aggregator,
so the hub meters and bills but cannot read identifiers, questions, or
answers. **This is documented here as the argument, but it is deliberately
NOT part of this filing.** Decision (2026-08-31): this enhancement files
items 2.1 (attested response), 2.2 (floor rule) and 2.4 (range on open
responses) only; item 2.3 is held for a separate, later companion
proposal. Reasons: the codeowner's invitation to file (comment 5479522050)
is worded narrowly around a signing mechanism — 2.1/2.2/2.4 are one
coherent subject, what the operator signs and how tightly the signed
payload is bounded; 2.3 is a different subject, who can read the exchange
in transit. v1 was rejected in part for bundling unrelated items into one
filing, and 2.3 is politically sensitive in a way 2.1/2.2/2.4 are not:
aggregators are CAMARA members, and this section asks them to give up the
ability to read content they do not need in order to meter and bill it —
not their commercial role, but a capability some may be reluctant to
concede. Bundling a politically sensitive item with an uncontroversial one
risks sinking both.

Honest cost of holding it back: without §2.3, an aggregator in the path
still sees the identifier and the question this filing carries — only the
attested boolean answer is signed and bound, not blinded from the hub.
Holding 2.3 is sequencing, not abandonment: a companion proposal follows,
and this document says so on purpose rather than letting the omission
pass silently.

### 2.4 Range on open predicate responses

Not every catalog answer is a boolean. SimSwap `/retrieve-date` returns a
timestamp (`latestSimChange`) and `/retrieve-age-band` (unreleased — see
below) returns a band index (`simSwapAgeBand`) — both open, ordered
values, not yes/no predicates. In profile mode such an API returns a
**range drawn from the operator's published menu** (e.g. "swapped within
the last 30–90 days"), never the point value and never a finer band than
the menu allows. The range is carried in the attestation payload the same
way a boolean answer is (§4): signed, nonce-bound, expiring, and bounded
by the same floor rule as §2.2 — the requester may ask for a coarser
range, never a finer one than the published menu offers.

(Verified 2026-08-31 against
`camaraproject/SimSwap/code/API_definitions/sim-swap.yaml`, branch
`main`: `/retrieve-date`'s `RetrieveSimSwapDateInfo.latestSimChange`, RFC
3339 timestamp, nullable — shipped in tagged release v2.1.0;
`/retrieve-age-band`'s `SimSwapAgeBandInfo.simSwapAgeBand`, standardized
band 1–17 plus sentinel `111` — this operation is **not in any tagged
release**. Checked against r3.3/r3.2 (`info.version: 2.1.0`), r3.1
(`2.1.0-rc.2`), and r2.2 (`2.0.0`): none of them carry
`/retrieve-age-band`; it exists only on unreleased branch `main`
(`info.version: wip`). The band range 1–17 and sentinel `111` above are
`main`-content-only and may still change before release.)

### 2.5 Why operators gain: no replay, no resale

Today an aggregator that carries the query can read the answer and could
serve it again from cache. With expiry alone (this filing), a stale answer
is worthless after `exp`, which already stops resale of a cached answer
past its window — the aggregator can still read the identifier and the
answer while it is live, it just cannot resell it once expired. The
stronger claim, that the aggregator cannot read the answer it carries at
all, needs the blind hub (§2.3), held for the companion filing. Every
fresh answer requires a fresh billed API call — operator revenue per
genuine query is protected rather than leaked into the middle. Honest
counterweight, unchanged from §6: the operator still logs the query, and
the requester can still cache an unexpired answer for its own use within
`exp`.

## 3. Signing standard

**JOSE/JWS, RFC 7515.** Reason to choose it over the alternatives the
reviewer named (SD-JWT VC, W3C VC):

- ICM's own Security Interoperability Profile already cites RFC 7515 —
  the DPoP extension claims `camara:qh` / `camara:bh` are Base64URL-encoded
  per RFC 7515 §2 (`CAMARA-Security-Interoperability.md`, "Additional
  Recommendations for DPoP Implementations", verified 2026-08-31). CAMARA
  already has JOSE tooling in its dependency graph on the request side.
- **Commonalities has already chosen JWS on the notification leg.**
  `camaraproject/Commonalities/documentation/CAMARA-API-Event-Subscription-and-Notification-Guide.md`,
  "Notifications Security Considerations" (lines 672–673, verified
  2026-08-31), states verbatim that CAMARA "RECOMMENDS that the Camara
  Notification is signed and then encrypted using [JSON Web Signature
  (JWS)] and [JSON Web Encryption (JWE)]." This proposal completes the
  same choice on the synchronous response leg — same signing standard,
  the other half of the request/response cycle. The delta, stated
  plainly: that guidance is scoped to asynchronous CloudEvent
  notifications, and `CAMARA-API-Design-Guide.md` (1714 lines, verified
  2026-08-31) contains zero references to RFC 9421, message signatures,
  or response signing. v1 was rejected in part for duplicating existing
  capability — leaving this adjacent precedent uncited would invite the
  same objection against v2.
- A boolean needs no selective disclosure. SD-JWT VC's core feature —
  disclosing a subset of claims from a larger credential — solves a
  problem this proposal does not have: there is exactly one claim, the
  bit itself.
- **Considered and not chosen:** SD-JWT VC (selective disclosure is the
  wrong tool for a single-bit payload); W3C Verifiable Credentials
  (heavier tooling and a different trust/issuance model than CAMARA's
  existing per-PLMN JWKS pattern would need to adopt wholesale).

**Relationship to ICM's DPoP profile — the symmetric counterpart.** DPoP's
`camara:bh` / `camara:qh` extension claims (RFC 9449 + the CAMARA
extension) bind the **request** — hashes of the query string and body,
inside a proof the client signs. This proposal binds the **response** —
the operator signs the answer, the nonce, and the expiry. Request-side and
response-side binding are two halves of one symmetric pattern; CAMARA has
shipped the first half and this proposal is the second.

## 4. Worked example: SimSwap `/check`

**Request** (unchanged fields, `nonce` added):

```json
POST /sim-swap/v2/check
{
  "phoneNumber": "+346661113334",
  "maxAge": 2160,
  "nonce": "b4333c46-49c0-4f62-80d7-f0ef930f1c46"
}
```

`phoneNumber` and `maxAge` are exactly `sim-swap.yaml`'s existing
`CreateCheckSimSwap` fields (verified 2026-08-31). `nonce` is the one
field this proposal adds. `maxAge` MUST equal one of the values on the
operator's published threshold menu (§2.2); a value off that menu is
refused with a 400 (`OFF_MENU_THRESHOLD`), never rounded to the nearest
menu value. Where the operator publishes the menu — in its API
documentation or a discovery document — is not settled by this document;
the publication mechanism is for Commonalities to settle.

**Response** (existing body plus one added field, `attestation`):

```json
{
  "swapped": false,
  "attestation": "<base64url(header)>.<base64url(payload)>.<signature>"
}
```

The `attestation` value is a JWS compact-serialized string:
`<base64url(header)>.<base64url(payload)>.<signature>`. Its decoded
payload:

```json
{
  "iss": "opengateway.operator.example",
  "aud": "requester.example",
  "nonce": "b4333c46-49c0-4f62-80d7-f0ef930f1c46",
  "iat": 1785960000,
  "exp": 1785960300,
  "maxAge": 2160,
  "swapped": false
}
```

| Field | Meaning |
|---|---|
| `iss` | Operator identifier, resolvable through its published JWKS (RFC 7517) |
| `aud` | Requester identifier |
| `nonce` | Echo of the requester's nonce from the request |
| `iat` | Issued-at, Unix epoch seconds |
| `exp` | Expiry, Unix epoch seconds — short-lived |
| `maxAge` | The window attested, in hours, as requested — the predicate parameter that gives the answer below its meaning |
| `swapped` | The attested answer itself |
| `kid` | (JWS header, not payload) Key id, resolvable via `iss`'s JWKS |

The payload carries both the query that defines the predicate (`maxAge`)
and the answer (`swapped`); a verifier that saw only `swapped: false`
would have no way to know what window that answer covers. The plain
`swapped` field in the response body is a convenience copy for clients
that do not verify; a verifier trusts only the value inside the signed
payload, never the plain copy.

**Verification steps** (any third party, offline):

1. Resolve the operator's JWKS from `iss` via its published JWKS endpoint — pin
   the expected operator key *before* verifying, never trust an in-band
   hint to select which key to check against (mirrors profile rule 3 from
   the v1 text, unchanged principle).
2. Verify the JWS signature against the resolved key.
3. Check `exp` has not passed and `nonce` matches one the verifier itself
   (or its principal) issued and has not already seen answered.
4. Read `maxAge` and `swapped` from the payload and check `maxAge` is the
   window the verifier's own policy requires — tighter is acceptable,
   looser is not.
5. Only after all four checks pass, act on `swapped`.

## 5. Adoption checklist for other predicate APIs

| API | Existing predicate | Profile-mode change |
|---|---|---|
| SimSwap `/check` | boolean `swapped` | add `nonce` to request, `attestation` to response (worked example above) |
| SimSwap `/retrieve-date` | timestamp `latestSimChange` | add `nonce` to request; response attests a **range from the published menu** (§2.4), never the point timestamp |
| SimSwap `/retrieve-age-band` (unreleased, `main` only — not in v2.1.0 or any tagged release) | band index `simSwapAgeBand` (1–17, sentinel `111`) | add `nonce` to request; response attests a **range from the published menu** (§2.4), never a finer band than the menu offers |
| Tenure `/check-tenure` | boolean `tenureDateCheck` | same shape: `nonce` on request, `attestation` on response |
| KnowYourCustomerAgeVerification `ageCheck` | string enum `'true'\|'false'\|'not_available'` | same shape; `'not_available'` MUST attest a refusal, never a rounded `'false'` |
| location-verification `verify` | `TRUE\|FALSE\|PARTIAL` | same shape; `PARTIAL` MUST attest a refusal, never a rounded boolean |

For each adopting API the payload carries that API's predicate parameters
and its answer field, under the same names the API already uses — e.g.
Tenure's payload would carry `tenureDate`/`contractType` and
`tenureDateCheck`, not `maxAge`/`swapped`.

Where the envelope itself would be specified in the Design Guide is not
settled by this document. `Commonalities/documentation/CAMARA-API-Design-Guide.md`'s
`## 6. Security` is proposed as the home (it already covers securing
REST APIs and expressing security requirements), with §3.1
"Business-level Outcomes in Successful Responses" (the existing pattern
for additive response-body fields) and §5.8.5 "Headers" (the existing
pattern for a cross-API special header, `x-correlator`) as alternatives —
final placement is **to be agreed with Commonalities maintainers**, not
invented here.

## 6. Honest limits

- **The operator query log is unchanged.** Signing the answer does not
  remove the fact that the operator (and, in Mode-A-shaped deployments,
  the aggregator) still logs who asked what about whom, when. This
  proposal narrows what crosses the wire in the response; it does not
  make the query private.
- **The JWKS directory is a centralization point.** Verifiers depend
  on a correctly governed, correctly rotated per-operator key directory;
  who governs it is not settled by this document.
- **Replay protection needs a nonce store on the requester side.**
  Signature verification is stateless; rejecting a replayed attestation
  requires the verifier to track which nonces it has already issued and
  seen answered.
- **A repeated-query oracle exists wherever a threshold is ordered.** A
  requester willing to pay for enough queries against the same subject can
  bisect an ordered threshold (e.g. `maxAge`) toward the underlying value
  even though every individual response is attested and windowed
  correctly. The floor's published menu (§2.2) caps the oracle's
  resolution at the menu's granularity; it does not close it. Per-query
  billing and per-subject rate limits are the economic backstop, not a
  structural fix.
- **This document never claims the underlying boolean, or the predicate
  pattern, is new.** The delta claimed here is exactly the envelope: a
  signature, a nonce binding, an expiry, and a floor rule. Nothing else.
- **kyc-match's threshold field is an open item, not resolved here.**
  kyc-match's primary response is per-field discrete indicators
  (`nameMatch`, `addressMatch`, `idDocumentMatch`, …), each a string enum
  `'true'|'false'|'not_available'` — it does not return a similarity
  score by default. An optional `MatchScoreResult` (0–100, Jaro-Winkler)
  exists, but is operator-capability-dependent and, per its spec
  description, "shall only be returned when the value of the
  corresponding match field is `false`" (r2.2, v0.3.0, verified
  2026-08-31). That conditioning does not weaken the hill-climbing
  concern — it sharpens it: the score surfaces exactly when the requester
  guessed wrong, which is the feedback a hill-climber needs. Separately,
  kyc-match's request has **no** existing threshold field, so a
  `numberMatch` menu (§2.2) would add a field to the request, which
  contradicts §2.2's "nothing is added to the request to carry the menu
  itself." Whether and how to profile kyc-match at all is not resolved
  by this document.

## References

- CAMARA API Backlog Scope Enhancement template:
  `camaraproject/APIBacklog/documentation/API-Scope-Enhancement-Template.md`
  (fetched 2026-08-31).
- CAMARA API Backlog enhancement issue template:
  `camaraproject/APIBacklog/.github/ISSUE_TEMPLATE/issue_enhancement_template.md`
  (fetched 2026-08-31; same template used by precedent APIBacklog issue #276,
  "Evolution of Consent Info API to support Controlled Delegation").
- CAMARA Security Interoperability Profile, "Additional Recommendations
  for DPoP Implementations": `camaraproject/IdentityAndConsentManagement/documentation/CAMARA-Security-Interoperability.md`
  (fetched 2026-08-31) — `camara:qh`/`camara:bh` extension claims,
  Base64URL-encoded per RFC 7515 §2.
- SimSwap v2.1.0 `/check`: `camaraproject/SimSwap/code/API_definitions/sim-swap.yaml`
  (fetched 2026-08-31) — `CreateCheckSimSwap` (`phoneNumber`, `maxAge`
  1–2400 hours) and `CheckSimSwapInfo` (`swapped` boolean).
- SimSwap `/retrieve-date` (v2.1.0, tagged release) and `/retrieve-age-band`
  (unreleased, branch `main` only — absent from every tagged release
  r2.2–r3.3): same file (fetched 2026-08-31) —
  `RetrieveSimSwapDateInfo.latestSimChange` (RFC 3339 timestamp, nullable)
  and `SimSwapAgeBandInfo.simSwapAgeBand` (standardized band 1–17,
  sentinel `111`); grounds §2.4.
- CAMARA API Design Guide: `camaraproject/Commonalities/documentation/CAMARA-API-Design-Guide.md`
  (fetched 2026-08-31, 1714 lines) — §3.1 Business-level Outcomes in
  Successful Responses, §5.8.5 Headers; zero references to RFC 9421,
  message signatures, or response signing (grounds §3's "why v2, not
  duplication" argument).
- CAMARA API Event Subscription and Notification Guide:
  `camaraproject/Commonalities/documentation/CAMARA-API-Event-Subscription-and-Notification-Guide.md`,
  "Notifications Security Considerations", lines 672–673 (fetched
  2026-08-31) — recommends JWS + JWE signing for CAMARA Notifications;
  prior art cited in §3.
- CAMARA Project Charter: `camaraproject/Governance/ProjectCharter.md`,
  line 62 (northbound-only scope) and line 248 (cross-sub-project
  decisions go to Commonalities).
- APIBacklog codeowner feedback, 2026-08-31:
  `camara/v1/docs/feedback-2026-08-31.md`.
- RFC 7515 (JSON Web Signature); RFC 7517 (JSON Web Key); RFC 9449 (DPoP).
- Precedent: APIBacklog #276/#277 "Consent Info — Controlled Delegation"
  (issue → backlog+TSC lazy consensus → linked sub-project issues → TSC
  Approved & Onboarding 2025-12-18).
