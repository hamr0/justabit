> POSTED 2026-11-26T08:31:22Z.
> URL: https://github.com/camaraproject/Commonalities/issues/705#issuecomment-7186695882
> Comment id: 7186695882.
> Posted by the main session with `gh issue comment`, from the user's GitHub account. The user approved the text shown on 2026-11-26 except one sentence; on "i will attend where possible, don't commit" the sentence "I will join the Number Insights meeting once the signing direction is clearer." was replaced with "I will attend the Number Insights meetings where possible." and the comment was posted. The user did not see the changed text before posting; this record is that text, read back.
> Answers rartych's 2026-11-23 review (`camara/v2/docs/commonalities-705-comment-received-2026-11-23.md`) and follows the reply `camara/v2/docs/commonalities-705-reply-posted-2026-11-23.md`. The AI-use line points back to that reply instead of repeating it (user choice). The Sync26 dates are from `docs/logs/findings.md` 2026-11-26.
> Read-back verification: `gh api repos/camaraproject/Commonalities/issues/comments/7186695882 --jq .body` compared with the sent file by `cmp` (trailing newlines ignored): exit 0, identical.
> Verbatim record — do not edit.

Thank you again for the review. Here is where each point stands.

**Response signing.** I raised it with Governance as you suggested: camaraproject/Governance#220. I narrowed it to one first case, Tenure `/check-tenure` and SimSwap `/check`, with no new API and no change to the answers.

**Sync26.** #705 (filed 2026-09-01) proposed that the operator sets the values it accepts, refuses any other value, and never answers a looser question. The releases since then do the first two:
- SimSwap r4.3 (v2.2.0): an operator may enforce a shorter `maxAge` and answers `400 OUT_OF_RANGE`. The dedicated `BadRequestWithRange400` is new since r4.2 (2026-10-20).
- Tenure r3.4 (v0.3.0): the operator's threshold date R, "not part of the API request", with `400 OUT_OF_RANGE`. It is new since r3.3 (2026-11-06).
- kyc-age-verification r2.3 (v0.3.0): an `ageThreshold` outside the values "agreed during onboarding" gets `400 OUT_OF_RANGE`. It is new since r2.2 (2026-11-19).

So I based the proposal on these releases. It now uses Sync26's own `OUT_OF_RANGE`, and my `OFF_MENU_THRESHOLD` is gone. It cites what Sync26 does as CAMARA's work. It keeps only what is still missing: a signed answer, a published set of questions, never accepting a looser question, and ranges on open values.

Also checked: NumberVerification r4.2 (v2.1.1), kyc-match and kyc-fill-in r2.3. `/retrieve-age-band` is out of the proposal, because it moved to SimSwapTimeFrame, which has no API definition yet. Spec, pinned to release tags and line numbers: https://github.com/hamr0/justabit/blob/main/docs/product/camara-v3-spec.md

**SimSwapTimeFrame.** I added a first written note on camaraproject/SimSwapTimeFrame#4 (repeated queries and band edges). I will attend the Number Insights meetings where possible.

**AI use and ownership.** As I wrote above: I use AI tools to design, draft and validate, and I steer the work. The decisions are mine.

**Windowed disclosure.** Parked here until the Governance/TSC direction is clear, as you suggested.

Is there anything else you need from me on this issue?

