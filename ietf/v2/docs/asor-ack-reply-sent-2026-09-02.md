> SENT 2026-09-02, private, to Rafael Asor (author of
> draft-asor-wimse-agent-delegation-chain).
> Subject: Re: acknowledgment wording for asor -01 (permission request).
> Reply to Rafael's private request for permission to name the user in
> the acknowledgments of draft-asor-wimse-agent-delegation-chain-01,
> which he said goes to the Datatracker Thursday. His proposed sentence:
>
>   "The "min" constraint type was added after Amr Hassan, author of
>   draft-hamr-oauth-agent-delegation, observed that -00 had no
>   comparator for a floor tightened upward; the "tenure_years" example
>   is his."
>
> Verbatim record of the user's own text — do not edit. The quoted
> original it replied to is omitted (private third-party message). No
> reply from Rafael has been received to this message yet.

Rafael,

Yes, please name me. No objection to the acknowledgment, and thank you for
asking before the fact rather than after.

One correction to the sentence, on the example rather than the name.

The axis in draft-hamr-oauth-agent-delegation-01 is "tenureMin", not
"tenure_years", and its value is a duration literal under a closed grammar
(P<n>D or P<n>Y, 1Y = 365D, months rejected), not a number of years. So
"tenure_years" does not name anything in my draft.

Two ways to fix it, whichever you prefer:

- If you mean to point at my draft, use "tenureMin" and call it duration-typed.
- If "tenure_years" is your own profile-level naming, keep it, but drop
  "the example is his" — the observation was mine, the name is yours.

Suggested wording:

  The "min" constraint type was added after Amr Hassan, author of
  draft-hamr-oauth-agent-delegation, observed that -00 had no comparator
  for a floor tightened upward; the duration-typed "tenureMin" axis of
  that document is the motivating example.

Everything else in your sentence is accurate as written.

One note for your -01, not an objection. My -01 was submitted 2026-09-02 and
says, in the axis-registry alignment paragraph, that a mirrored "min" "has
been stated as intended for a future revision of that draft; it is not
present in [asor] as posted." That was true on my submission date. Once your
-01 posts Thursday it stops being true, and I will correct it in my -02
rather than leave it standing. Nothing for you to do; I mention it so the
stale sentence does not read as a disagreement.

Best,
Amr

No reply from Rafael has been sent to this message.
