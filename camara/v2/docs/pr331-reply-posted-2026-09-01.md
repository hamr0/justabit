> POSTED 2026-09-01.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5492957947
> Comment id: 5492957947.
> Posted by the user from their own GitHub account.
> First post (11:03:55Z) was corrupted by a paste error that truncated
> three lines mid-word; repaired in place by a PATCH from a file at
> 11:04:39Z. GitHub shows the comment as edited.
> Verbatim record — do not edit.

Agreed on both points, and on all four next steps. Thank you both — the
route is now unambiguous.

Confirming the sequence we will follow:

1. **Commonalities issue first.** We will open the Scope Enhancement issue
   in `camaraproject/Commonalities` using that repo's `💡 Enhancement 🌟`
   template. Scope is the response envelope only: a JWS (RFC 7515)
   attestation bound to a requester nonce, with an expiry, whose payload
   carries the predicate parameters and the answer; plus an
   operator-published threshold menu, where an off-menu threshold is
   refused and never silently rounded. First adoption example is SimSwap
   `/check`. Positioned as the response-side counterpart to ICM's
   request-side DPoP claims (`camara:bh` / `camara:qh`), so it can be
   written up in the CAMARA API Design Guide once agreed.

2. **Supporting material on #330.** We will upload the OpenAPI sketch and
   the revised proposal document there, and link them from the
   Commonalities issue rather than duplicating the text.

3. **WG slot after discussion, not before.** We will request a slot once
   the Commonalities issue has had discussion, so the session references a
   live issue. Understood that this likely moves us past the 10 September
   session.

4. **Aggregator item kept separate.** The end-to-end encryption item
   (hub meters and bills without reading identifiers or answers) will be a
   distinct follow-on issue in Commonalities, filed only once the signing
   envelope baseline is accepted, and referencing it.

Use case 2 (AI-agent holder presentment / trust directory) stays withdrawn
from CAMARA, as stated above; it continues only on the IETF track.

We will post the Commonalities issue link back here once it is open.

<sub>Edited to repair three lines truncated by a paste error in the original post. No change of substance.</sub>
