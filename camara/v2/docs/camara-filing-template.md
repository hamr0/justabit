> **This is the filled CAMARA API Scope Enhancement template**, per
> `camaraproject/APIBacklog/documentation/API-Scope-Enhancement-Template.md`
> (fetched 2026-08-31; headings below are verbatim and in the same order).
> This is step 2 of the two-step intake: step 1 is the short GitHub issue
> body, `camara/v2/docs/camara-filing-issue.md`. NOT FILED — drafting only,
> 2026-08-31, following APIBacklog codeowner feedback on the v1 filing
> (`camara/v1/docs/feedback-2026-08-31.md`).
>
> This document supersedes the v1 API-proposal-template filing
> (`camara/v1/docs/camara-filing-template.md`, frozen as filed under PR
> #331) in intent, not in record — the v1 file stays an immutable record
> of what was actually submitted. Amend `camara-attested-windowed-disclosure.md`
> (v2) for design changes, not this file, once this is filed.

<!-- ==== EVERYTHING BELOW THIS LINE IS THE TEMPLATE BODY ==== -->

## API name

Commonalities — CAMARA API Design Guide (catalog-wide), first adoption:
SimSwap `/check`.

## New API name

None — this is a Scope Enhancement to Commonalities' design guidance, not
a new API or API family.

## Scope Enhancement owner

Cairenes Solutions.

## Scope Enhancement summary

CAMARA's predicate APIs (SimSwap `/check`, Tenure `/check-tenure`, KYC Age
Verification `ageCheck`, location-verification `verify`) already answer in
booleans. Today that boolean is TLS-only, trusted by the direct caller
only, replayable, and non-transferable to a third party. This enhancement
adds three things to the response envelope, catalog-wide, via Commonalities:
(1) a **signed, nonce-bound, expiring attestation** over the existing
answer, as a JWS (RFC 7515) verifiable offline through a per-operator JWKS
(RFC 7517); (2) a **floor rule** — the operator publishes a threshold menu,
the requester may only tighten it, off-menu requests are refused, never
rounded; (3) an **optional** end-to-end-encrypted "blind hub" mode so an
aggregator meters and bills without reading identifiers, questions, or
answers. First adoption example: SimSwap `/check`.

Two business cases: (1) a bank authorizes a transfer on "unswapped ≥ 90
days" and holds a signed attestation it can show its own auditor without
calling the operator a second time; (2) a relying party's independent
auditor re-verifies a previously issued attestation offline, against the
operator's published JWKS, months later, without any new API call.

## CAMARA scope alignment

### Northbound API type

- [x] Service API
- [ ] Service Management API

### Scope fit with CAMARA

Northbound only — this enhancement adds fields to the request/response of
existing customer-facing Service APIs (SimSwap, and by the adoption
checklist, Tenure/KYC-age/location-verification); it introduces no
east-west, federation, or roaming surface. Project Charter
(`camaraproject/Governance/ProjectCharter.md`) line 62: "CAMARA only works
on customer-facing northbound APIs. East-west federation / roaming APIs
are out of scope for CAMARA" — satisfied, nothing here crosses that line.
Line 248: "Technical decisions that span multiple parts of the CAMARA
Project should be discussed and made in the Commonalities Working Group"
— this is exactly such a decision, which is why it is filed as a
Commonalities Scope Enhancement rather than against any single
sub-project.

### Telco capability exposed

The operator's existing signing authority over facts it already computes
and already exposes as booleans (SIM-swap recency, tenure, age
verification, location match) — no new telco capability, only a
cryptographic attestation layer over capabilities already in the catalog.

### Overlap with existing CAMARA APIs

- [x] The CAMARA API portfolio has been reviewed, and it has been
  confirmed that there is no overlap.

Stated plainly rather than left as a checkbox: SimSwap `/check`, Tenure
`/check-tenure`, and KYC Age Verification `ageCheck` already answer the
underlying boolean question — this enhancement changes only the response
**envelope** around that existing answer (attestation + floor), not the
predicate itself. There is no overlap in the sense of a duplicate
capability; there is deliberate, acknowledged overlap in the sense that
this enhancement's adoption checklist touches those APIs' response shapes.
This full-portfolio review sweep was run 2026-08-31, after the v1 filing's
own "no overlap" declaration (2026-08-14, re-verified 2026-08-24) was
found to have missed the Tenure API — see the LESSON entry in
`docs/logs/findings.md`, 2026-08-31.

## Scope change justification

### Why backlog validation is required

This is a cross-sub-project change to the response format used across
multiple existing CAMARA APIs (SimSwap, Tenure, KYC Age Verification,
location-verification), which is exactly the class of decision Project
Charter line 248 routes to Commonalities and, per APIBacklog process, to
API Backlog Working Group validation before a design-guideline change
lands.

### Impact on the existing API scope

Extends existing APIs with an additive response field (`attestation`) and
one additive request field (`nonce`); no new repository, no new API
family, no broader scope needed. Existing non-attested request/response
shapes remain valid and unchanged — this is a new, opt-in profile mode,
not a breaking change.

### Explicit out-of-scope items for this enhancement

New predicates or fact types (nothing beyond what SimSwap, Tenure,
KYC-age, and location-verification already compute); holder presentment
(Mode B, proof-based credential presentment without an inbound identifier);
agent identity or agent-grade floor bundles; consent-flow changes (rides
existing ICM mechanisms unchanged); the aggregator's commercial model
(per-query billing and revenue share are unaffected by design). All of
these remain live only in the IETF track (`ietf/v1/docs/`), not here.

## Technical viability

JWS (RFC 7515) signing and JWKS (RFC 7517) key resolution — both standard
JOSE tooling, already partially present in CAMARA's dependency graph via
ICM's DPoP profile (`camara:qh`/`camara:bh` extension claims are
Base64URL-encoded per RFC 7515 §2). Reference PoC status: the v1 PoC
(`camara/v1/poc/`, Node.js, zero dependencies) implements the same
signed-nonce-bound-expiring-boolean pattern using raw Ed25519 signatures
over a closed claim set, not yet JWS. Migrating the PoC's signing layer
from raw Ed25519 to JWS/JWKS is **planned**, not done — it is the next
code module for this repository and needs its own user checkpoint before
it starts (see `camara/v2/poc/README.md`).

## Commercial viability

Open-source JOSE libraries exist and are widely adopted for exactly this
kind of signing/verification: `node-jose` (https://github.com/cisco/node-jose)
and `jose` (https://github.com/panva/jose, npm `jose`) both implement
JWS/JWK/JWKS per RFC 7515/7517 and are actively maintained. Either would
be a candidate dependency for a production (non-PoC) implementation; the
reference PoC in this repository stays zero-dependency by policy and
therefore does not adopt either yet.

## YAML code available?

YES — illustrative, non-normative sketch at `camara/v2/spec/carrier-attestation.yaml`,
reshaped to the SimSwap `/check` adoption example (single path,
`POST /sim-swap/v2/check`, real request/response fields from
`camaraproject/SimSwap/code/API_definitions/sim-swap.yaml` plus the added
`nonce`/`attestation` fields).

## Validated in lab/productive environments?

YES, sandbox tier only. The Mode A PoC (raw-Ed25519 envelope, not yet
migrated to JWS) was run live against the Orange Network APIs Playground,
an operator public sandbox environment (not a production network),
exercising Orange's test tier with scripted test numbers. User-run, by
exit code, all green: `m5-check-live.mjs` 20/20 and
`demo.mjs --backend orange` 35/35 (CHANGELOG 0.5.0, 2026-08-18), with an
injected clock and quota accounted 1-of-10 custom slots at both start and
end. These runs exercised the envelope shape (signed, nonce-bound,
expiring boolean) on raw Ed25519 signatures, not on JWS — stated
precisely, because the JWS migration has not yet been run against the
Playground. No production environment has been exercised.

## Validated with real customers?

NO.

## Validated with operators?

NO — no operator has reviewed or validated this enhancement.

## Supporters in API Backlog Working Group

*(left blank per the template's own instruction: "List of supporters.
NOTE: That shall be added by the Working Group.")*
