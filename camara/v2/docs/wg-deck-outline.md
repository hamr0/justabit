> **WG deck outline, ≤ 10 slides.** Drafted 2026-08-31 for the next
> APIBacklog WG session (Thu 2026-09-10 09:00 UTC or Thu 2026-09-24 15:00
> UTC). NOT presented. Each block below is one slide's text content.

## 1. Problem

- CAMARA predicate APIs already answer subscriber/device questions as
  booleans — but the boolean is TLS-only.
- Trusted only by the direct caller; nothing travels beyond that hop.
- Replayable: nothing binds a response to a specific requester or moment.
- Non-transferable: a relying party's own auditor can't re-verify it
  later without calling the operator again.
- The gap is the envelope around the answer, not the answer itself.

## 2. What exists already

| API | Predicate operation | Response shape |
|---|---|---|
| SimSwap `/check` | boolean `swapped` | TLS-only, no nonce, no expiry |
| Tenure `/check-tenure` | boolean `tenureDateCheck` | TLS-only, no nonce, no expiry |
| KYC Age Verification `ageCheck` | enum `'true'\|'false'\|'not_available'` | TLS-only, no nonce, no expiry |
| location-verification `verify` | `TRUE\|FALSE\|PARTIAL` | TLS-only, no nonce, no expiry |

## 3. The delta (four items only)

- **Attested response** — signed (JWS), nonce-bound, expiring, verifiable
  offline by any third party via a per-operator JWKS.
- **Floor rule** — operator publishes a threshold menu; requester may
  only tighten; off-menu is refused, never rounded.
- **Blind hub** — proposed as part of this enhancement; end-to-end
  encryption through an aggregator so it meters and bills without reading
  content; placement (same enhancement or separate) is an open question
  put to the codeowner 2026-08-31.
- **Range on open predicate responses** — for open-value answers (SimSwap
  `/retrieve-date`, `/retrieve-age-band`), attest a range from the
  published menu, never the point value.
- Operator revenue: expiry + blinding remove the replay and resale path
  — a stale or unread answer can't be served again from an aggregator's
  cache, so each genuine query stays a fresh billed API call.

## 4. Wire example — SimSwap `/check`

- Request adds `nonce` to the existing `phoneNumber`/`maxAge`; `maxAge`
  must be one of the operator's published menu values or the request is
  refused (`OFF_MENU_THRESHOLD`), never rounded.
- Response adds one field, `attestation` (JWS compact string), beside the
  existing `swapped` boolean.
- Attestation payload: `iss`, `aud`, `nonce`, `iat`, `exp`, `maxAge`
  (the window attested), `swapped` (the attested answer), `kid` in the
  JWS header.
- Verification is offline: resolve JWKS from `iss`, check signature,
  check `exp`/`nonce`, then read `maxAge`/`swapped` from the payload.

## 5. Signing choice: JWS

- RFC 7515 (JWS) + RFC 7517 (JWKS).
- ICM's DPoP profile already encodes per RFC 7515 §2 — tooling is already
  partway into CAMARA's dependency graph.
- SD-JWT VC: solves selective disclosure across many claims — this
  proposal has exactly one claim, the bit. Not chosen.
- W3C Verifiable Credentials: heavier tooling and a different
  trust/issuance model than the existing per-PLMN JWKS pattern. Not
  chosen.

## 6. Symmetry with ICM

- ICM's DPoP extension (`camara:qh`, `camara:bh`) binds the **request** —
  hashes of the query string and body inside a client-signed proof.
- This proposal binds the **response** — the operator signs the answer,
  nonce, and expiry.
- Two halves of one symmetric pattern; CAMARA has shipped the request
  half already.

## 7. Path and precedent

- Filed as ONE Commonalities Scope Enhancement, not a new sub-project.
- Precedent: APIBacklog #276/#277, "Consent Info — Controlled
  Delegation" — issue → backlog+TSC lazy consensus → linked sub-project
  issues → TSC Approved & Onboarding 2025-12-18.
- Same two-step intake: short issue first, filled Scope Enhancement
  template as a follow-up PR.

## 8. Honest limits

- The operator query log is unchanged — this narrows the response, not
  the query.
- The JWKS directory is a centralization point; governance is not
  settled here.
- Replay rejection needs a nonce store on the requester side.
- A repeated-query oracle exists on any ordered threshold; the floor
  menu caps its resolution, it does not close it.

## 9. Ask

- Guidance on where in the Design Guide the envelope should be specified
  (candidates: §3.1 Business-level Outcomes, §5.8.5 Headers — final call
  is the maintainers').
- Named supporters, per Working Group process (populated during
  evaluation, not a precondition of filing).
- Operator revenue: expiry + blinding remove the replay and resale path.

## 10. Links

- Proposal v2: `camara/v2/docs/camara-attested-windowed-disclosure.md`.
- OpenAPI sketch: `camara/v2/spec/carrier-attestation.yaml`.
- v1 filed record (superseded by this rescoping): APIBacklog issue #330 /
  PR #331.
