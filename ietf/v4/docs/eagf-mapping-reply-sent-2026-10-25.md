> SENT 2026-10-25, direct email, confirmed sent by the user (text unchanged from the session draft, per the user).
> To: Tania, Alygn (taniaalygn@gmail.com)
> Subject: reply to `eagf-mapping-received-2026-10-25.md` (this same directory)
> Verbatim record of the user's own text — do not edit.

Tania,

Thank you for the mapping. It is clear, and I agree that the two drafts can meet at the root link without a change to the chain format. Three points where I read it differently:

1. REQ-1. The narrowing rule in -03 matches the "subset" part of REQ-1. It does not match the content list. A link in -03 carries scope, floors and expiry. It has no purpose field, and the delegator is identified only by the signature. So I would say that -03 meets part of REQ-1, not that it fits directly.

2. REQ-7. -03 does not state "a verifier does not inherit trust from upstream" as a rule. The nearest rule is in Attenuation Rules: a verifier checks every pair of links and L(0) itself, and it rejects the whole chain if one rule fails. That supports REQ-7, but please do not quote it as a sentence from -03.

3. The root-link pointer. -03 already gives you a handle for it. The chain identifier is the SHA-256 digest of L(0)'s signature, and every link shares it (Chain Identifier section). But a decision record keyed to that value is a stable handle for the whole chain, across every Relying Service that sees the chain. -03 requires the agent identifier to be unlinkable across Relying Services, and it leaves the tension with audit stability open for the Working Group (Agent Identifier section). A decision-record pointer adds to that tension, and I think EAGF's privacy section should name it.

With those three points, I have no further comments for now. I will keep the mapping as input for a later revision.

Amr
