> RECEIVED 2026-09-03, private, from Rafael Asor (author of
> draft-asor-wimse-agent-delegation-chain), confirming -01 is posted and
> that the user's acknowledgment is in it as agreed. Verified independently
> against the posted bytes, not taken from the email. Also records the -02
> paired task this creates: bumping the cited reference from -00 to -01,
> together with rewriting the "not present ... as posted" sentence that
> reference currently supports — the posted -01 text is NEVER edited to
> reflect this; the correction belongs only in -02.

VERBATIM as pasted by the user, 2026-09-03.

--- Rafael Asor (to Amr) ---

Amr,

The -01 is posted: https://datatracker.ietf.org/doc/draft-asor-wimse-agent-delegation-chain/01/

Your acknowledgment is in it as you asked: the "min" constraint type was added after you observed that -00 had no comparator for a floor tightened upward, with the duration-typed "tenureMin" axis of your document as the motivating example. Thank you again for reading it against the bytes.

Rafael

---

## Verification performed by the main session

The claims above were NOT taken from the email. The posted text was
fetched from `https://www.ietf.org/archive/id/draft-asor-wimse-agent-delegation-chain-01.txt`
and read directly. Confirmed:

1. Posted 3 September 2026, expires 7 March 2027. 784 lines. Title
   "Verifiable Attenuated Delegation for AI Agent Chains", author
   R. Asor (Attenu).
2. The `min` constraint type IS present, in Section 4.2 "Constraint
   Vocabulary", verbatim:

   > "min" : a number. The value of the associated quantity MUST NOT be
   > less than it (e.g. {"key": "tenure_years", "min": 2}). Where "max"
   > carries a ceiling tightened downward, "min" carries a floor
   > tightened upward.

3. The acknowledgment IS present, in Appendix A, verbatim:

   > The "min" constraint type was added after Amr Hassan, author of
   > [I-D.hamr-oauth-agent-delegation], observed that -00 had no
   > comparator for a floor tightened upward; the duration-typed
   > "tenureMin" axis of that document is the motivating example.

4. The `tenureMin` correction WAS taken: the acknowledgment says
   "duration-typed \"tenureMin\" axis", not "tenure_years". The user
   had corrected this in the consent round
   (`asor-ack-reply-sent-2026-09-02.md`).
5. `tenure_years` remains the key in asor's OWN §4.2 example. Rafael
   said in an earlier round that it would, and that is his own
   example, not a claim about the HAMR draft. This is correct and
   needs no action.
6. asor -01 cites the HAMR draft in its references:

   > [I-D.hamr-oauth-agent-delegation]  Hassan, A., "An Attenuated
   > Delegation Profile for ...", draft-hamr-oauth-agent-delegation-01,
   > 2 September 2026.

## The consequence for HAMR -02

`ietf/v2/docs/draft-hamr-oauth-agent-delegation-01.xml` contains, at
lines 1484-1489:

```
A mirrored min
comparator, matching this document's min, has been stated as
intended for a future revision of that draft; it is not present
in <xref target="I-D.asor-wimse-agent-delegation-chain"/> as
posted, and this document does not describe it as present.
```

That sentence is **not yet false.** The reference block at lines
1739-1747 pins the citation to `-00` (both the `target` URL and the
`seriesInfo value` say `draft-asor-wimse-agent-delegation-chain-00`).
Read against `-00`, the sentence remains true.

It becomes false the moment `-02` bumps that reference to `-01`, which
`-02` must do — project doctrine requires re-verifying every cited
draft's version live before any submission or revision. So the `-02`
task is a PAIR that must be done together, or the document contradicts
itself:

1. bump the `I-D.asor-wimse-agent-delegation-chain` reference from
   `-00` to `-01`, and
2. rewrite the "not present ... as posted" sentence, because `min` IS
   now present in `-01`.

The posted `-01` (`draft-hamr-oauth-agent-delegation-01.xml`) is NEVER
edited. This correction belongs only in `-02`.
