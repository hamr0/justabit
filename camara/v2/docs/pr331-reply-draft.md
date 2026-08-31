> **Draft comment for APIBacklog PR #331. NOT POSTED.** Prepared 2026-08-31
> in reply to codeowner feedback (comment id 5476128475,
> `camara/v1/docs/feedback-2026-08-31.md`). Links below point only to
> paths that exist on `main` today; v2 materials under `camara/v2/` are
> not yet on `main` and are described as "will be attached to the issue".

<!-- ==== EVERYTHING BELOW THIS LINE IS THE COMMENT BODY — PASTE FROM HERE (≤ 30 lines) ==== -->

Thank you for the detailed review — all three points land.

1. **Charter alignment:** accepted. Use case 2 (AI-agent holder
   presentment / trust directory) is withdrawn from CAMARA entirely — east
   -west infrastructure the Charter excludes — and continues only as a
   separate submission to the IETF OAuth Working Group.

2. **Overlap:** accepted, and we found more than you flagged. Our own
   portfolio sweep turned up the Tenure API (`/check-tenure`,
   TSC-approved 2024-05-16), which already answers a tenure predicate the
   same way SimSwap and KYC Age Verification do. Our filed template's
   "no overlap" declaration (`docs/product/camara-filing-template.md` on
   `main`) was wrong on that point; corrected here ourselves.

3. **Signing layer in Commonalities:** accepted. Resubmitting as a Scope
   Enhancement on Commonalities, not a new sub-project, with SimSwap
   `/check` as the first adoption example. Signing standard: JWS
   (RFC 7515) — ICM's own DPoP claims already encode per RFC 7515 §2, and
   a boolean needs no selective disclosure, so SD-JWT VC/W3C VC were
   considered and not chosen.

**Next:** opening a new issue, "[Scope Enhancement] Attested responses
for CAMARA APIs (Commonalities; first adoption SimSwap)", with the
rewritten proposal, the reshaped OpenAPI sketch, and a short WG deck
attached — will be attached to the issue. Requesting a slot at the next
APIBacklog WG session: Thu 2026-09-10 09:00 UTC or Thu 2026-09-24 15:00
UTC, whichever the chairs prefer.
