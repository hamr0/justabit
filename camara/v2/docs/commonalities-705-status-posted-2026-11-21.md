> POSTED 2026-11-21T16:30:24Z.
> URL: https://github.com/camaraproject/Commonalities/issues/705#issuecomment-7065696847
> Comment id: 7065696847.
> Posted by the main session with `gh issue comment`, on the user's instruction ("post both", 2026-11-21), from the user's GitHub account.
> Status update on the Scope Enhancement filed in
> `camara/v2/docs/commonalities-705-filed-2026-09-01.md`; it delivers the supporting materials that the issue said would follow, and asks for a Commonalities Working Group agenda slot.
> Read-back verification: the posted body was fetched back with `gh issue view --json comments` and diffed against the local draft. Result: content IDENTICAL; the only difference is one trailing newline added by the read-back. Local draft 1660 bytes; posted body via the API 1661 bytes (`jq` output, one trailing newline).
> Verbatim record — do not edit.

Status update, and the supporting materials this issue said would follow.

**Supporting materials** (pinned to one commit, so the links do not move):

- Proposal v2: [camara-attested-windowed-disclosure.md](https://github.com/hamr0/justabit/blob/0078804a1d71/camara/v2/docs/camara-attested-windowed-disclosure.md)
- OpenAPI sketch, illustrative and not normative: [carrier-attestation.yaml](https://github.com/hamr0/justabit/blob/0078804a1d71/camara/v2/spec/carrier-attestation.yaml)
- Proof of concept of the JWS attestation core (Node, no dependencies): [camara/v2/poc](https://github.com/hamr0/justabit/tree/0078804a1d71/camara/v2/poc)

The scope is unchanged from the issue text: a JWS (RFC 7515) attestation over the existing answer, bound to the requester's nonce, with an expiry; an operator-published threshold menu that a requester can only tighten; and a range instead of a point value on open-value predicates. Encryption through an aggregator stays out of this ask.

**TSC questions.** The TSC raised three points on 2026-09-03 (OPG encryption, aggregators, Security Profile path). The answers are on [APIBacklog PR #331](https://github.com/camaraproject/APIBacklog/pull/331). In short: sign first, then encrypt; no aggregator has reviewed the design yet; and Commonalities is the home, with algorithm and JWKS pinning as possible later profile work.

**Request.** Can the Commonalities Working Group put this issue on the agenda of an upcoming meeting? I will attend to present it and take questions. If the maintainers want a different shape first, for example a draft Design Guide section as a pull request, please say so and I will prepare it.
