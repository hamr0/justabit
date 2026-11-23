> POSTED 2026-11-23T12:46:54Z.
> URL: https://github.com/camaraproject/Commonalities/issues/705#issuecomment-7101615313
> Comment id: 7101615313.
> Posted by the main session with `gh issue comment`, on the user's instruction ("post it", 2026-11-23), from the user's GitHub account. Drafted by the main session from the user's points; the AI-use paragraph follows the user's own account of how they work, and the zkagent paragraph was added at the user's request.
> Replies to `camara/v2/docs/commonalities-705-comment-received-2026-11-23.md`.
> Read-back verification: the posted body was fetched back with `gh api .../issues/comments/7101615313 --jq .body` and diffed against the local draft. Result: content IDENTICAL; the only difference is one trailing newline added by the read-back (3170 bytes local, 3171 read back).
> Verbatim record — do not edit.

Thank you for the review. All four points are fair. In order:

**Response signing.** Agreed: this is a Governance/TSC decision, and one Commonalities issue cannot settle it. I will raise it there. On contracts: I agree that they already cover aggregator behaviour between the parties to them. A signed answer adds something for a party outside those contracts, such as an auditor or a downstream relying party, who must check an answer later without calling the operator again.

**Sync26.** You are right, and I should have caught it. `/retrieve-age-band` left SimSwap before r4.1 and is now in SimSwapTimeFrame, but this issue still cites it. I am checking every API reference again against the current releases (SimSwap r4.3, Tenure r3.4 and the others) and will post the corrections here. I will also join the SimSwapTimeFrame work: the age band is close to what I mean by windowed disclosure.

**AI use.** I use AI tools a lot, to design, draft and validate, and to drive the development. I steer that work, and the decisions are mine. They come from my experience: about ten years in roaming and interconnect, and close work on A2P messaging products. In A2P I saw the weak points of the model, and I saw much of 2FA move from SMS to apps. I also care about privacy. Data about subscribers is collected and combined across many sources, and I think telecom can do better: earn from what the network knows, without collecting or exposing more than the question needs. That is why this proposal is opinionated: it answers yes or no, and does not return the underlying data. I will join the Commonalities meeting to go through it and answer questions directly.

**A small first case.** One use I see is AI agents. A service that deals with an agent may want to know that an established mobile line stands behind it. This does not say who the person is. It makes creating many such agents costly. CAMARA already answers most of this: Tenure r3.4 returns `tenureDateCheck`, and SimSwap `/check` returns `swapped`. Both are booleans. A signed response on just those two would let a party that is not the direct caller rely on them, with no new API and no change to the answers. I would like to bring that narrow case to the Governance/TSC discussion as a first example, not as a way around it.

**The same principle elsewhere.** This is not a one-off. I apply the same rule in my other open-source work: answer the one question asked, as a yes or no, and keep the raw data where it is. [zkagent](https://github.com/hamr0/zkagent) does this for identity documents: the chip in a passport answers a question such as "over 18?", and the site gets only the answer. Despite its name, it uses no zero-knowledge proofs; the privacy comes from disclosing one bit. On the agent side, my IETF individual draft, [draft-hamr-oauth-agent-delegation](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/), describes how an agent carries such answers with narrow, delegated permissions. This proposal does not depend on either. They show the same direction from other sides.

**Windowed disclosure.** Agreed: first the overall direction, then the Commonalities guidance.
