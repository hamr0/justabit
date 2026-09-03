> POSTED 2026-09-03T15:35:34Z.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5528133063
> Comment id: 5528133063.
> Posted by the user from their own GitHub account.
> Replies to the TSC relay recorded in
> `camara/v2/docs/pr331-tsc-comment-received-2026-09-03.md`.
> Read-back verification: the posted body was fetched back from the
> GitHub API and diffed against the local draft. Result: content
> IDENTICAL. The only difference is that three bullet lines under point
> 2 lost their three-space indentation in the paste, and GitHub returned
> CRLF line endings. The rendered HTML was then checked: the ordered
> list splits into `<ol>` (items 1-2), the `<ul>`, then `<ol start="3">`.
> GitHub set `start="3"` itself, so the comment renders correctly as
> 1, 2, 3. No visible defect. Both local and posted bodies measured
> 3294 bytes.
> Verbatim record — do not edit.

Thank you for relaying the TSC's points.

1. **GSMA OPG e2e encryption.** They coexist, and the composition order matters: **sign first, then encrypt to the requester.** If the response were encrypted first and the signature applied over the ciphertext, the requester would end up verifying whoever did the encrypting, not the operator that made the assertion. Sign-then-encrypt keeps the operator's attestation verifiable end to end while the encryption layer hides it from any intermediary. Encryption itself stays out of this enhancement — that is already stated in camaraproject/Commonalities#705 as a deliberate omission, not left silent, and will follow as a separate companion enhancement (the "blind hub": end-to-end encryption of request and response through an aggregator, so the hub meters and bills without reading identifiers or answers). On coordination: I am an independent contributor with no member company, so I have no OPG seat and cannot carry this into OPG myself. I would welcome the TSC, or any member company, relaying it there. The filing does not conflict with an OPG response-encryption mechanism: signing is a separate layer, composing under the order above.

2. **Aggregators.** One correction first: what is filed *signs* the response; it does not encrypt it. An aggregator in the path can still read the identifier and the answer. "Meters and bills without reading the predicate or answer" describes the blind hub, which is held for the companion enhancement in point 1, not the current filing — this limit is stated on purpose in the proposal, not an oversight.
- Validated with aggregator operators: no. No aggregator operator has reviewed the design. Input from one would be welcome — that's a real gap the TSC could help close.
- Aggregator contract or interface change: no. No new endpoint, no new contract clause. The delta is additive — one request field (`nonce`) and one response field (`attestation`).
- Capability change: yes, one. Cache-substitution stops working. Today an aggregator that sees a query can read the answer and serve a later identical query from cache. With a requester-bound nonce and an expiry, a cached answer carries the wrong nonce and a dead `exp`, so it can't be substituted for a fresh query. That protects the operator's per-query billing against resale of a stale answer.

3. **Commonalities vs. the Security and Interoperability Profile.** Commonalities is the home now; I'd rather name a boundary condition than pre-commit a migration. Commonalities covers artifacts common to all APIs — data types, error formats, headers, the CloudEvents envelope — the request/response layer. The Security and Interoperability Profile (ICM, r4.2) restricts options within OIDC/CIBA — the token acquisition and presentation layer. The attestation is a response body field, carried in neither a token nor a DPoP proof, so structurally it sits in Commonalities. The boundary condition: the profile already does the mirror-image job request-side, with the `camara:qh`/`camara:bh` DPoP claims this filing cites as its counterpart. If the attestation's algorithm set, JWKS discovery, or replay window ever need normative pinning across providers, that part is profile work. The schema and pattern stay in Commonalities.
