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
**Target:** CAMARA Commonalities, as ONE Scope Enhancement, with SimSwap
`/check` as the first adoption example
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
east-west verifiable-credential infrastructure the Charter excludes;
(2) the overlap with KYC Age Verification and SimSwap age-band is
functional, not inspirational — both already return a predicate over an
operator-held fact, and the only delta is the signing wrapper;
(3) a signed-response layer belongs in Commonalities, where it applies
consistently catalog-wide, not in a new sub-project.

v2 therefore: drops use case 2 and the whole Mode B / agent-grade-floor /
trust-directory design entirely from this document (it lives only at the
IETF); drops the CarrierAttestation new-case filing and its template
mapping; renumbers the normative rules down to the three-item delta the
catalog does not already have; and reframes the filing vehicle as a single
Commonalities Scope Enhancement instead of a new APIBacklog sub-project.
One correction made visible rather than quietly fixed: the v1 filing's
"no overlap" declaration was itself wrong — it missed the Tenure API
(`/check-tenure`, TSC-approved 2024-05-16) — see §Adoption checklist and
the LESSON entry in `docs/logs/findings.md` 2026-08-31.

## 1. Problem statement

CAMARA APIs answering questions about a subscriber or device already
return a predicate on every axis this proposal cares about:

| API | Predicate endpoint | Response shape |
|---|---|---|
| SimSwap v2.1.0 | `POST /check` | boolean `swapped` |
| Tenure (Vodafone, TSC-approved 2024-05-16, r3.2) | `POST /check-tenure` | boolean `tenureDateCheck` (+ optional `contractType`) |
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

## 2. The three-item ask

This document proposes exactly three additions, as ONE Commonalities Scope
Enhancement, on top of the existing predicate responses above — nothing
else.

### 2.1 Attested response

The existing boolean answer, signed by the operator as a JWS (RFC 7515),
bound to a requester-supplied nonce, with an expiry, verifiable by any
third party through a per-operator JWKS (RFC 7517). See §4 for the
SimSwap `/check` worked example.

### 2.2 Floor rule

The operator publishes a threshold menu (a floor); the requester may only
tighten it. Off-menu requests are refused loudly, never rounded. Today
thresholds are free-form — SimSwap `/check`'s `maxAge` accepts any integer
hour 1–2400 (verified against `sim-swap.yaml`, `CreateCheckSimSwap.maxAge`);
Tenure's `tenureDate` accepts any date. Floors are monotone: any party
downstream may tighten, never loosen; widening is a distinct,
consent-visible operation, never a default.

### 2.3 Blind hub (optional, clearly marked optional)

End-to-end encryption of the request and response through an aggregator,
so the hub meters and bills but cannot read identifiers, questions, or
answers. This part is separable from 2.1 and 2.2, and is stated plainly as
politically sensitive: aggregators are CAMARA members, and this section
does not ask them to give up their commercial role, only the ability to
read content they do not need in order to meter and bill it.

## 3. Signing standard

**JOSE/JWS, RFC 7515.** Reason to choose it over the alternatives the
reviewer named (SD-JWT VC, W3C VC):

- ICM's own Security Interoperability Profile already cites RFC 7515 —
  the DPoP extension claims `camara:qh` / `camara:bh` are Base64URL-encoded
  per RFC 7515 §2 (`CAMARA-Security-Interoperability.md`, "Additional
  Recommendations for DPoP Implementations", verified 2026-08-31). CAMARA
  already has JOSE tooling in its dependency graph on the request side.
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

**Request** (unchanged fields, `nonce` and `floor` added):

```json
POST /sim-swap/v2/check
{
  "phoneNumber": "+346661113334",
  "maxAge": 2160,
  "nonce": "b4333c46-49c0-4f62-80d7-f0ef930f1c46",
  "floor": { "maxAgeMenu": [720, 2160, 4380, 8760] }
}
```

`phoneNumber` and `maxAge` are exactly `sim-swap.yaml`'s existing
`CreateCheckSimSwap` fields (verified 2026-08-31). `nonce` and `floor` are
the two fields this proposal adds; `floor` states the requester's own
accepted menu, closed-set and tighten-only per §2.2.

**Response** (existing body plus one added field, `attestation`):

```json
{
  "swapped": false,
  "attestation": "eyJhbGciOiJFUzI1NiIsImtpZCI6Im9wZW5nYXRld2F5Lm9wZXJhdG9yLmV4YW1wbGUuMjYyMDEifQ.eyJpc3MiOiJvcGVuZ2F0ZXdheS5vcGVyYXRvci5leGFtcGxlIiwiYXVkIjoicmVxdWVzdGVyLmV4YW1wbGUiLCJub25jZSI6ImI0MzMzYzQ2LTQ5YzAtNGY2Mi04MGQ3LWYwZWY5MzBmMWM0NiIsImlhdCI6MTc4NTk2MDAwMCwiZXhwIjoxNzg1OTYwMzAwLCJyZXNwb25zZUhhc2giOiI0N0RFUXBqOEhCU2EtX1RJbVctNUpDZXVRZVJrbTVOTXBKV1pHM2hTdUZVIn0.<signature>"
}
```

The `attestation` value is a JWS compact-serialized string. Its decoded
payload:

| Field | Meaning |
|---|---|
| `iss` | Operator identifier, resolvable through its published JWKS (RFC 7517) |
| `aud` | Requester identifier |
| `nonce` | Echo of the requester's nonce from the request |
| `iat` | Issued-at, Unix epoch seconds |
| `exp` | Expiry, Unix epoch seconds — short-lived |
| `responseHash` | SHA-256 (Base64URL, RFC 7515 §2) of the canonical response body (`{"swapped":false}`), so the attestation is bound to the exact answer given, not just to the fact that *an* answer was given |
| `kid` | (JWS header, not payload) Key id, resolvable via `iss`'s JWKS |

**Verification steps** (any third party, offline):

1. Resolve the operator's JWKS from `iss` via its published JWKS endpoint — pin
   the expected operator key *before* verifying, never trust an in-band
   hint to select which key to check against (mirrors profile rule 3 from
   the v1 text, unchanged principle).
2. Verify the JWS signature against the resolved key.
3. Check `exp` has not passed and `nonce` matches the nonce the verifier
   itself (or its principal) issued.
4. Recompute `responseHash` over the response body actually received and
   compare.
5. Only if all four pass, trust `swapped: false` as attested.

## 5. Adoption checklist for other predicate APIs

| API | Existing predicate | Profile-mode change |
|---|---|---|
| SimSwap `/check` | boolean `swapped` | add `nonce`+`floor` to request, `attestation` to response (worked example above) |
| Tenure `/check-tenure` | boolean `tenureDateCheck` | same shape: `nonce`+`floor` on request, `attestation` on response |
| KnowYourCustomerAgeVerification `ageCheck` | string enum `'true'\|'false'\|'not_available'` | same shape; `'not_available'` MUST attest a refusal, never a rounded `'false'` |
| location-verification `verify` | `TRUE\|FALSE\|PARTIAL` | same shape; `PARTIAL` MUST attest a refusal, never a rounded boolean |

Where the envelope itself would be specified in the Design Guide is not
settled by this document. Two sections of
`Commonalities/documentation/CAMARA-API-Design-Guide.md` are candidate
homes — §3.1 "Business-level Outcomes in Successful Responses" (the
existing pattern for additive response-body fields) and §5.8.5 "Headers"
(the existing pattern for a cross-API special header, `x-correlator`) —
but which one, or a new section, is **to be agreed with Commonalities
maintainers**, not invented here.

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
- CAMARA API Design Guide: `camaraproject/Commonalities/documentation/CAMARA-API-Design-Guide.md`
  (fetched 2026-08-31) — §3.1 Business-level Outcomes in Successful
  Responses, §5.8.5 Headers.
- CAMARA Project Charter: `camaraproject/Governance/ProjectCharter.md`,
  line 62 (northbound-only scope) and line 248 (cross-sub-project
  decisions go to Commonalities).
- APIBacklog codeowner feedback, 2026-08-31:
  `camara/v1/docs/feedback-2026-08-31.md`.
- RFC 7515 (JSON Web Signature); RFC 7517 (JSON Web Key); RFC 9449 (DPoP).
- Precedent: APIBacklog #276/#277 "Consent Info — Controlled Delegation"
  (issue → backlog+TSC lazy consensus → linked sub-project issues → TSC
  Approved & Onboarding 2025-12-18).
