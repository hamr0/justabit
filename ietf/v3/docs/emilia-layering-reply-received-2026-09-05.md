> RECEIVED 2026-09-05, direct email. No exact timestamp was captured.
> From: Iman Schrock, EMILIA Protocol, Inc. — author of both
> `draft-schrock-ep-authorization-receipts` and
> `draft-schrock-action-evidence-boundary` (AEB).
> Subject: reply to the layering reply on HAMR -02's AEB sentence — see
> `emilia-layering-reply-sent-2026-09-04.md` (this same directory) for
> the message this one answers.
> Verbatim record — do not edit.

Amr,

This is much cleaner. "What was approved and consumed, once" fixes the
layer, and separating the post-result detector was the right
consequence.

Of the two omitted clauses, exact-action matching is load-bearing.
Without it, the AEB sentence can read like a generic local
authorization and atomicity model. "Native verification" can stay in
the reference for the sake of length. I would make the sentence:

"[AEB] complements it with an executor-side model for exact-action
matching, local authorization, atomic consumption, and outcome
reconciliation at invocation, including a requirement to enumerate
every path that bypasses it."

The local-versus-system-wide bypass distinction also reads correctly
to me. No equivalence and no priority is the right posture.

Yes, please acknowledge the correction by name, narrowly: "Iman
Schrock for clarifying the receipts/AEB execution boundary and bypass
relationship." That records the contribution without implying
authorship.

Thank you for sending the final text before -02. I'll check that exact
version when it arrives.

Best,
Iman

---

**Response recorded here for the file record.**

- Iman accepted the layering fix as sent on 2026-09-04: the relabeled
  layer (c) ("what was approved and consumed, once") and the removal of
  the post-result detector from Appendix A's layer-(c) mapping.
- Of the two clauses cut from his original suggested wording,
  he ruled exact-action matching load-bearing — without it the AEB
  sentence reads as a generic local authorization and atomicity model —
  and accepted the omission of native verification, for the sentence's
  length, leaving it in the reference only.
- He confirmed the local-versus-system-wide bypass distinction in the
  2026-09-04 reply as correct: no equivalence claimed between AEB's
  single-executor bypass enumeration and this document's system-wide
  closure invariant, and no priority between the two.
- He granted acknowledgment by name, in this exact narrow form: "Iman
  Schrock for clarifying the receipts/AEB execution boundary and bypass
  relationship."
- He still expects the final layering text before -02 is posted, per
  the commitment made in the 2026-09-04 reply. That text has not been
  sent to him yet.
