> SENT 2026-09-01T20:11:29+02:00.
> Subject: Re: Private preflight on our R10 carrier readings
> Sent by the user from their own account. Second reply on the same
> private pre-flight thread, replying to Rafael Asor (author of
> draft-asor-wimse-agent-delegation-chain-00), who had written that
> asor carries floors via a must-understand constraint-type registry
> and shares the three-layer reading, and to Iman Schrock (EMILIA
> Protocol team lead), who confirmed the matrix will keep the two
> NOT_SUPPORTED grades framed as by-design fail-closed behaviour,
> keep the three layers, describe AEB as one composition, and stay
> pinned to posted revisions.
> This reply was written against a full read of asor -00 (Sections
> 4.1, 4.2, 9.1, and 10 cited, each verified against the posted
> text). It corrects Rafael's "-01" citation to -00 Section 10, names
> the comparator vocabulary -- not a shared axis-name registry -- as
> the real bridge between the two drafts, notes asor's "rank"
> comparator and its missing "min", and names Section 9.1 as a
> problem the two drafts share.
> Verbatim record of the user's own text — do not edit. Any quoted
> original is omitted (private third-party messages).

Iman, thank you -- the "by design" framing on the two grades and the
matrix pinned to posted revisions is exactly right. Nothing from me is a
claim until it has text.

Rafael, I read asor -00 in full before replying, so this is against the
posted bytes, not memory. Three notes.

1. The registry you describe is already in -00, not only in your -01:
Section 10 requests an "Agent Delegation Constraint Types" registry,
Specification Required, and Section 4.1 makes an unknown type deny
at every verifier. So on that part nothing waits on -01. Agreed on
the shape, and if a HAMR registry happens I would rather match yours
than invent a second one. Still "may".

2. The precise convergence, which is narrower than "same registry":
asor registers comparator TYPES (max, one_of, not_one_of, prefix,
rank) and leaves the constrained quantity as a profile naming
agreement, as Iman restates. HAMR -00 does the reverse: it fixes
axis NAMES, each with a built-in comparator. The bridge is therefore
the comparator vocabulary, not a shared name registry. Two concrete
points on that bridge:
- asor's "rank" is exactly the comparator an ordered-enumeration
floor needs; HAMR -00 has only equality enumerations and
durations.
- asor has "max" but no "min". Every HAMR duration floor is a
minimum (tenureMin >= P2Y) tightened upward; Section 4.2's
subsumption tightens ceilings downward. One missing comparator is,
as far as I can see, the whole gap between the two documents'
floor mechanics. Whether that belongs in asor's registry or is
simply expressed as max over a negated quantity is your call; I
only want to name it.

3. Section 9.1 states a problem HAMR shares: a parent stays valid after
attenuation, so a holder of the parent keeps the broader authority.
Your mitigations (short TTL, holder binding, status lists) are the
same three HAMR would point to. Worth saying in both documents that
this is shared and out of the token profile's power to fix alone --
it is the layer (c) boundary again.

Carrier remains the only real difference: token chain versus an RFC
9421 signature over the HTTP message. Same layer, same spot.

I will say anything further on the OAuth list with text, not before.

Amr


[Quoted original omitted — a private message from a third party, not reproduced here.]
