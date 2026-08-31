> **This is the text to paste into a new GitHub issue** at
> `camaraproject/Commonalities` (route decided 2026-08-31 by a
> Commonalities codeowner — see PR #331 comment
> [5479522050](https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5479522050)),
> using that repo's `💡 Enhancement 🌟` issue template
> (`.github/ISSUE_TEMPLATE/issue_enhancement_template.md`, fetched
> 2026-08-31; four fields: Problem description, Possible evolution,
> Alternative solution, Additional context — the same template used by
> precedent issue #276, "Evolution of Consent Info API to support
> Controlled Delegation"). Title to use:
> `[Enhancement] Attested responses for CAMARA APIs — signed, nonce-bound, expiring answers; floor menu; range on open responses`.
> Label: `enhancement`.
>
> This is step 1 of a two-step intake; step 2 is a follow-up pull request
> adding the filled Scope Enhancement template as
> `documentation/API proposals/` (path TBD) — that file is
> `camara/v2/docs/camara-filing-template.md` in this repo, kept as the
> secondary artifact for if Commonalities or the Backlog WG asks for it.
> NOT FILED — drafting only, 2026-08-31.

<!-- ==== EVERYTHING BELOW THIS LINE IS THE ISSUE BODY — PASTE FROM HERE ==== -->

**Problem description**

SimSwap `/check`, Tenure `/check-tenure`, KYC Age Verification `ageCheck`,
and location-verification `verify` already answer subscriber/device
questions as booleans. Today that boolean is TLS-only: trusted by the
direct caller only, replayable, and non-transferable — a relying party's
own auditor cannot re-verify it later without calling the operator again.

**Possible evolution**

Add, as a Commonalities design guideline any predicate API can adopt: (1)
a signed, nonce-bound, expiring attestation over the existing answer (JWS,
RFC 7515, verifiable offline via per-operator JWKS); (2) a floor rule —
the operator publishes a threshold menu, the requester may only tighten
it; (3) end-to-end encryption through an aggregator so it meters and bills
without reading identifiers, questions, or answers; (4) for open-value
predicates (SimSwap `/retrieve-date`, `/retrieve-age-band`), a range from
the published menu instead of the point value. First adoption example:
SimSwap `/check`, worked wire example attached. The guideline would live
in the Design Guide, candidate `## 6. Security` (alt. §3.1, §5.8.5) —
maintainers decide placement.

**Alternative solution**

SD-JWT VC or W3C Verifiable Credentials were considered for the signing
layer and not chosen: both solve selective disclosure across multiple
claims, which this proposal does not need — there is exactly one claim,
the bit itself. JWS is also already partially present in CAMARA's own
tooling via ICM's DPoP extension claims (RFC 7515 §2 encoding).

**Additional context**

This is a resubmission of a proposal previously filed as a new
sub-project (APIBacklog issue #330 / PR #331), reframed per codeowner
feedback (2026-08-31) that the signing layer belongs in Commonalities and
that the previous use case 2 (AI-agent holder presentment) is
Charter-excluded east-west infrastructure — use case 2 is withdrawn from
CAMARA and pursued only at the IETF. Expiry and the blind hub also protect
operator revenue: neither lets an aggregator replay or resell an answer it
cannot read or that has gone stale, so each genuine query stays a fresh
billed API call. Supporting materials (proposal v2, OpenAPI sketch) to
follow on this issue. Filed on the advice of a Commonalities codeowner on
[APIBacklog PR #331](https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5479522050) (where #330/#331 was reviewed); the
aggregator-blinding item's placement (here or separate) is open — asking the maintainers' preference.
