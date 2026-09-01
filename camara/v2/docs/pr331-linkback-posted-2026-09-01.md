> POSTED 2026-09-01T11:24:29Z.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5493181312
> Comment id: 5493181312.
> Posted by the user from their own GitHub account.
> Links back from APIBacklog PR #331 to the newly filed
> `camaraproject/Commonalities#705`, as promised in the prior reply
> (see `camara/v2/docs/pr331-reply-posted-2026-09-01.md`).
> Verbatim record — do not edit.

Step 1 is done. The Scope Enhancement issue is open in Commonalities:

**camaraproject/Commonalities#705** — [Enhancement] Attested responses for CAMARA APIs — signed, nonce-bound, expiring answers; floor menu; range on open responses

It is scoped to the response envelope only, as agreed: a JWS (RFC 7515) attestation bound to a requester nonce with an expiry, verifiable offline via per-operator JWKS; the operator-published threshold menu, where an off-menu threshold is refused and never silently rounded; and a range rather than a point value on open-value predicates. SimSwap `/check` is the first adoption example. It is positioned as the response-side counterpart to the CAMARA Security and Interoperability Profile's request-side DPoP proof claims (`camara:bh` / `camara:qh`).

The aggregator end-to-end encryption item is held out, as agreed, and is stated in the issue as a deliberate omission rather than left silent. It will follow as a separate companion enhancement once this baseline is discussed.

Supporting material (revised proposal document and the OpenAPI sketch) will go on #330 next, linked from #705 rather than duplicated.

@albertoramosmonagas @rartych — thank you both for the routing guidance.
