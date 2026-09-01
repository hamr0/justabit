> FILED 2026-09-01T11:15:19Z.
> Repo: `camaraproject/Commonalities`, issue #705.
> URL: https://github.com/camaraproject/Commonalities/issues/705.
> Title: "[Enhancement] Attested responses for CAMARA APIs — signed,
> nonce-bound, expiring answers; floor menu; range on open responses".
> Filed by the user from their own GitHub account.
> Label `enhancement` is pending maintainer triage — the author's
> permission on this repo is `pull` only (no triage, no push), so the
> author cannot apply the label themselves.
> Body integrity verified: 460 words posted vs 460 words intended, zero
> word-level differences (only line rewrapping differs between the
> committed draft and the posted issue).
> Verbatim record — do not edit.

**Problem description**

SimSwap `/check`, Tenure `/check-tenure`, KYC Age Verification `ageCheck`, and location-verification `verify` already answer subscriber/device questions as booleans. Today that boolean is TLS-only: trusted by the direct caller only, replayable, and non-transferable — a relying party's own auditor cannot re-verify it later without calling the operator again.

**Possible evolution**

Add, as a Commonalities design guideline any predicate API can adopt: (1) a signed, nonce-bound, expiring attestation over the existing answer (JWS, RFC 7515, verifiable offline via per-operator JWKS); (2) a floor rule — the operator publishes a threshold menu, the requester may only tighten it; (3) for open-value predicates (SimSwap `/retrieve-date`, tagged; `/retrieve-age-band`, unreleased — `main` only, not in any tagged SimSwap release), a range from the published menu instead of the point value.
First adoption example: SimSwap `/check`, worked wire example attached. The guideline would live in the Design Guide, candidate 

`## 6. Security`

(alt. §3.1, §5.8.5) — maintainers decide placement. A fourth item, end-to-end encryption through an aggregator so it meters and bills without reading identifiers, questions, or answers, is deliberately held out of this ask and will follow as a separate companion enhancement (see Additional context).

**Alternative solution**

SD-JWT VC or W3C Verifiable Credentials were considered for the signing layer and not chosen: both solve selective disclosure across multiple claims, which this proposal does not need — there is exactly one claim, the bit itself. JWS is also already partially present in CAMARA's own tooling: the CAMARA Security and Interoperability Profile binds the REQUEST side with DPoP proof JWTs (RFC 9449) carrying the `camara:bh` and `camara:qh` extension claims. This proposal is the response-side counterpart to that same mechanism, built on the same JOSE primitives (RFC 7515).

**Additional context**

This is a resubmission of a proposal previously filed as a new sub-project (APIBacklog issue #330 / PR #331), reframed per codeowner feedback (2026-08-31) that the signing layer belongs in Commonalities and that the previous use case 2 (AI-agent holder presentment) is Charter-excluded east-west infrastructure — use case 2 is withdrawn from CAMARA and pursued only at the IETF. Expiry alone (this filing) already protects operator revenue against resale of a stale answer, since an aggregator cannot replay or resell an answer that has gone stale, keeping each genuine query a fresh billed API call — the stronger claim, that the aggregator cannot read the answer it carries at all, needs blind-hub encryption and is deliberately held out of this filing (decided
2026-08-31, on the codeowner's narrowly-worded invitation to propose a signing mechanism): a companion enhancement proposing the blind hub will follow separately, so this omission is stated rather than silent. Supporting materials (proposal v2, OpenAPI sketch) to follow on this issue. Filed on the advice of a Commonalities codeowner on [APIBacklog PR #331](https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5479522050) (where #330/#331 was reviewed).
