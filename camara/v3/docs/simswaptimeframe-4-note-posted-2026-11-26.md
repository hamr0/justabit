> POSTED 2026-11-26T08:07:38Z.
> URL: https://github.com/camaraproject/SimSwapTimeFrame/issues/4#issuecomment-7186218051
> Comment id: 7186218051.
> Posted by the main session with `gh issue comment`, on the user's instruction ("post3 all good, do all", 2026-11-26), from the user's GitHub account. It makes true the sentence in `docs/product/camara-v3-spec.md` §4.4 "The author contributes these on camaraproject/SimSwapTimeFrame#4".
> Posted text = the draft from "One point for the initial definition" to the end; the draft's "Sources read" note was not posted. Wrapped lines were joined into paragraphs; a word-by-word check against the draft was True.
> Read-back verification: `gh api repos/camaraproject/SimSwapTimeFrame/issues/comments/7186218051 --jq .body` compared with the sent file by `cmp` (trailing newlines ignored): exit 0, identical.
> Verbatim record — do not edit.

One point for the initial definition, from the windowed-disclosure work on Commonalities#705.

The band hides the exact swap date in a single answer. Repeated answers can still find it. A consumer that asks for the band of one line every hour sees the hour the band changes, for example from band 1 to band 2. The band edge is 4 hours, so the swap happened 4 hours before that change, to within one hour. The same works at every edge in the table.

No band shape stops this, because the band is relative to the time of the request. Two things help:
- one sentence in the API description, so consumers and providers know that repeated queries for one line disclose more than one answer does;
- a provider limit on repeated queries for the same line.

I suggest adding that sentence when the definition is carried over. I am happy to draft it.

