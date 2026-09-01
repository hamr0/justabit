> SENT 2026-09-01T17:23:09+02:00.
> Subject: Re: Private preflight on our R10 carrier readings
> Sent by the user from their own account, to the EMILIA team lead;
> the authors of asor-00, reece-02, mcphillips-01.
> Reply to a private pre-flight email from the EMILIA Protocol team
> (Iman Schrock), copied to the authors of
> draft-asor-wimse-agent-delegation-chain-00,
> draft-reece-wimse-cross-org-delegation-02, and
> draft-mcphillips-agentenvelope-derived-authority-01, asking each
> author to source-check EMILIA's reading of their draft in
> conformance/composition/wimse-r10-aeb-v0.1/matrix.json at commit
> 18fde1a of github.com/emiliaprotocol/emilia-protocol.
> The reply confirms the HAMR row and grants limited quoting rights:
> points 1-2 attributed, point 3 only with "may" intact.
> Verbatim record of the user's own text — do not edit. The quoted original it replied to is omitted (private third-party message).

Iman, Morgan, Rafael, Matthew,

Thank you for the source check, and for the care in the matrix. I have
read the HAMR row, the basis text for each criterion, README.md, and
CANDIDATE-NATIVE-CARRIER.md at commit 18fde1a. Here is my reading of
your reading of draft-hamr-oauth-agent-delegation-00.

1. The row is accurate. I have no correction to any grade.

2. One nuance on the two NOT_SUPPORTED grades, which I would ask you to
keep when you take this to the WIMSE list. The closed floor axis set
is deliberate. Section 8 says an unknown axis MUST cause the verifier
to reject the link outright, and MUST NOT be silently dropped. So
"cannot honestly claim native support" is exactly right, and it is
the profile failing closed as designed, not an omission. Your own
carrier note already says this in its last paragraph; I would just
ask that the matrix basis carry the same framing, so a reader does
not take NOT_SUPPORTED as "did not think of it".

3. Sections 8 and 17 both state that a registry for floor axes is
future work for this version. A -01 revision may add a registered
axis mechanism with must-understand semantics: a verifier that does
not recognise a registered critical axis refuses the link, and an
unregistered axis still fails closed. I say "may". Nothing is
drafted, and nothing here is a commitment. If it happens I will say
so on the OAuth list with the text, not before.

4. An observation you are free to use or ignore. The carrier contract
in CANDIDATE-NATIVE-CARRIER.md -- a child may preserve or tighten a
requirement, may never remove, lower, or weaken it, and an unknown
profile refuses the chain -- is the monotone tightening rule of
Section 8.2, applied to one more axis. In HAMR's vocabulary,
required_evidence is a floor axis. The only thing that stops it
riding on -00 is the closed axis set in point 2. That is a smaller
gap than the matrix's five NOT_MET/NOT_SUPPORTED cells suggest, and
it is the gap point 3 is about.

5. On the remaining NOT_MET cells -- consumption on admission, the
indeterminate state, and no blind retry -- I read the matrix as
describing three layers, and I think that reading is worth making
explicit somewhere: (a) who may act, the delegation chain; (b) what
exactly may be done, the action binding; (c) what happened, once --
admission, consumption, indeterminate outcome. HAMR -00 is layer (a)
plus floors, on purpose. Section 9.2 hands consumed-nonce state to
the verifier because a verification profile should not mandate the
stateful, linearisable store that layer (c) needs. So I would not
expect a future HAMR revision to grow layer (c). It should compose
with something that owns it. Your AEB is one such thing; I would
describe it as one composition, not as a dependency in either
direction.

6. You may quote points 1 and 2 on the WIMSE list, attributed. Please
quote point 3 only with the word "may" intact. Points 4 and 5 are
discussion, not a position of the draft.

Thank you again for representing the boundaries as drawn rather than as
you might wish them drawn. That is rarer than it should be.

Ciao, Amr


[Quoted original omitted — a private message from a third party, not reproduced here.]

