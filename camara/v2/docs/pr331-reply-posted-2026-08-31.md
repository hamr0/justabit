> POSTED 2026-08-31.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5479308991
> Comment id: 5479308991.
> Posted by the user from their own GitHub account.
> Verbatim record — do not edit.

Thank you for the review — all three points are accepted.

1. **Charter alignment:** use case 2 (AI-agent holder presentment / trust directory) is withdrawn from CAMARA. It continues only as a separate IETF submission.
2. **Overlap:** accepted, and we found one more. Our own portfolio sweep turned up the Tenure API (`POST /check-tenure` → boolean `tenureDateCheck`, TSC-approved 2024-05-16). The filed template's "no overlap" statement was wrong on that point; corrected here.
3. **Signing layer in Commonalities:** accepted. We will resubmit as a Scope Enhancement targeting Commonalities, with SimSwap `/check` as the first adoption example. The delta is only the envelope: a JWS (RFC 7515) attestation bound to a requester nonce, with an expiry, whose payload carries the predicate parameters and the answer; plus an operator-published threshold menu (off-menu refused, never rounded). Signing: JWS, as the response-side counterpart of ICM's request-side DPoP claims (`camara:bh` / `camara:qh`).

Two scoping questions before we file, so we file it right:

- **Route:** the Scope Enhancement template is written for an existing API. For a catalog-wide response-envelope change, should we (a) file the Scope Enhancement here in APIBacklog naming Commonalities as the target, or (b) open an enhancement issue directly in the Commonalities repository?
- **Aggregator item:** we also have an optional item — end-to-end encryption through an aggregator so the hub meters and bills without reading identifiers or answers. Should that ride in the same enhancement, or be kept separate?

We will upload the OpenAPI sketch and the revised proposal document on issue #330 as supporting material, and would welcome a slot at the next APIBacklog WG session (10 or 24 September, whichever the chairs prefer) with a short deck covering the problem, the revised use cases, the signing choice, and the Scope Enhancement path.

